import React, { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { LogOut, Settings as SettingsIcon, Shield } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { useMyProfile, usePlayerActions, useAvatarUpload } from '../players/usePlayers'
import { isE164 } from '../../lib/whatsapp'
import { levelProblem } from '../../lib/parseLevel'
import { errorMessage } from '../../lib/errors'
import { processAvatar } from '../../lib/processAvatar'
import { ownAvatarFilename } from '../players/playerQueries'
import { GROUP_SETTINGS_PATH, LOBBY_PROMPTS, type ProfileForm } from './settingsHelpers'
import AccountSection from './AccountSection'
import SignInSecuritySection from './SignInSecuritySection'
import ProfileSection from './ProfileSection'
import AccountStatsSection from './AccountStatsSection'
import AccountOrdersSection from './AccountOrdersSection'
import { PageHeader } from '../../components/ui/PageHeader'
import LobsterWayLink from '../../components/LobsterWayLink'
import { useToast } from '../../lib/toastBus'
import { Section } from '../../components/ui/Section'
import { ListCard, LinkRow } from '../../components/ui/ListCard'
import { LinkCardIcon } from '../../components/ui/LinkCard'
import { Button } from '../../components/ui/Button'

export default function Settings() {
  const { session, role, logout, isAdmin } = useApp()
  const { updatePlayer } = usePlayerActions({ session, role })
  const avatarUpload = useAvatarUpload()
  const { showToast } = useToast()
  const claimedId = session?.user?.id ?? null
  // Own profile: identity from the public roster merged with PII from
  // get_my_profile_v2. Single source — no separate poll/overlay, so a
  // background refetch can't flash or stomp the form. profileLoadFailed
  // surfaces a failed/empty PII read so the form doesn't sit blank and
  // silently stuck on "Loading" forever.
  const { data: myPlayer, hasPii, piiUnavailable: profileLoadFailed } = useMyProfile(claimedId)

  const [profileExpanded, setProfileExpanded] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: '',
    country: '',
    gender: '',
    isLeftHanded: false,
    preferredPosition: '',
    playtomicLevel: '',
    tagline: '',
    email: '',
    phone: '',
    birthday: '',
    avatarUrl: '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  // Once the user touches the form it's "dirty"; the seed effect below then
  // stops re-initialising from myPlayer so a background refetch / cache
  // invalidation cannot wipe out unsaved edits. Reset to false after a
  // successful save so the form re-seeds from the server's saved values.
  const profileDirty = useRef(false)
  const editProfileForm = useCallback((updater: (form: ProfileForm) => ProfileForm) => {
    profileDirty.current = true
    setProfileForm(updater)
  }, [])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [activePrompt, setActivePrompt] = useState(2) // default to "War Cry"

  // Playtomic update popup — show if player hasn't visited settings in 30+ days
  const [showPlaytomicPrompt, setShowPlaytomicPrompt] = useState(false)
  const [seedKey, setSeedKey] = useState(0)

  // Seed the form from myPlayer (roster identity + PII, already merged by
  // useMyProfile). Skipped once the form is dirty so an in-flight edit is never
  // overwritten by a refetch.
  useEffect(() => {
    if (profileDirty.current) return
    // Don't seed from a record whose PII overlay hasn't resolved yet — a
    // seed here would silently blank email/phone/birthday in the form, and
    // saving would then write those blanks back over the real values.
    if (!hasPii) return
    if (myPlayer) {
      setProfileForm({
        name: myPlayer.name || '',
        country: myPlayer.country || '',
        gender: myPlayer.gender || '',
        isLeftHanded: myPlayer.isLeftHanded || myPlayer.is_left_handed || false,
        preferredPosition: myPlayer.preferredPosition || myPlayer.preferred_position || '',
        playtomicLevel: myPlayer.playtomicLevel > 0 ? String(myPlayer.playtomicLevel) : '',
        tagline: myPlayer.tagline || '',
        email: myPlayer.email || '',
        phone: myPlayer.phone || '',
        birthday: myPlayer.birthday || '',
        avatarUrl: myPlayer.avatarUrl || myPlayer.avatar_url || '',
      })
      setAvatarPreview(myPlayer.avatarUrl || myPlayer.avatar_url || null)
      // Restore selected prompt category
      const savedLabel = myPlayer.taglineLabel || myPlayer.tagline_label || ''
      if (savedLabel) {
        const idx = LOBBY_PROMPTS.findIndex((p) => p.label === savedLabel)
        if (idx >= 0) setActivePrompt(idx)
      }
    }
  }, [myPlayer, hasPii, seedKey])

  const myPlayerId = myPlayer?.id
  useEffect(() => {
    if (!hasPii || !myPlayerId) return
    const lastCheck = localStorage.getItem(`lobster_playtomic_check_${claimedId}`)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    if (!lastCheck || parseInt(lastCheck) < thirtyDaysAgo) setShowPlaytomicPrompt(true)
  }, [myPlayerId, hasPii, claimedId])

  // Closing the editor without saving discards the edits: the form re-seeds from the server.
  const cancelProfileEdit = () => {
    profileDirty.current = false
    setAvatarFile(null)
    setProfileError('')
    setProfileExpanded(false)
    setSeedKey((key) => key + 1)
  }

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    profileDirty.current = true
    setAvatarFile(file)
    const reader = new FileReader()
    // readAsDataURL always yields a string; the guard is for the union type.
    reader.onload = (ev) => {
      const { result } = ev.target ?? {}
      setAvatarPreview(typeof result === 'string' ? result : null)
    }
    reader.readAsDataURL(file)
  }

  const handleProfileSave = async () => {
    if (!myPlayer) return
    // hasPii guards against saving before the PII overlay has actually
    // resolved to a row — the form fields below (phone/birthday especially)
    // are only trustworthy once that overlay is in. Without this, a save
    // issued in that window would write blanks over real values.
    if (!hasPii) {
      setProfileError('Your profile is still loading — try again in a moment.')
      return
    }
    // Phone validation: required to be E.164 so wa.me links work for
    // transfer offers. Allow blank (the user might have an empty phone
    // on file from before this validation existed) but reject malformed
    // values when present.
    if (profileForm.phone && !isE164(profileForm.phone)) {
      setProfileError('Phone must start with + and the country code (e.g. +31612345678).')
      return
    }
    const levelError = levelProblem({ value: profileForm.playtomicLevel, min: 0.5 })
    if (levelError) {
      setProfileError(levelError)
      return
    }
    setProfileSaving(true)
    setProfileError('')
    try {
      let avatarUrl = profileForm.avatarUrl || ''
      if (avatarFile) {
        let processed: Blob
        try {
          processed = await processAvatar(avatarFile)
        } catch (err) {
          console.error('Avatar processing error:', err)
          alert('Photo could not be processed: ' + errorMessage(err))
          setProfileSaving(false)
          return
        }
        // A failed upload is non-fatal: the profile still saves, just with the
        // previous photo.
        try {
          const publicUrl = await avatarUpload.mutateAsync({
            file: processed,
            // Stable filename (upsert) so a player only ever has one avatar
            // object; the cache buster makes the CDN serve the new one.
            filename: ownAvatarFilename(myPlayer.id),
          })
          avatarUrl = `${publicUrl}?v=${Date.now()}`
        } catch (err) {
          console.error('Avatar upload error:', err)
          alert('Photo could not be saved: ' + errorMessage(err))
        }
      }
      // Explicit field list, not `{ ...myPlayer, ... }` — spreading myPlayer
      // used to reintroduce `email` (myPlayer.email, whatever it currently
      // is) into the payload despite the comment below, and admins route
      // through admin_update_player, a different code path, so an admin
      // editing their own profile could silently null their own email.
      await updatePlayer(myPlayer.id, {
        name: profileForm.name,
        country: profileForm.country,
        gender: profileForm.gender,
        isLeftHanded: profileForm.isLeftHanded,
        preferredPosition: profileForm.preferredPosition,
        playtomicLevel: profileForm.playtomicLevel,
        tagline: profileForm.tagline,
        taglineLabel: LOBBY_PROMPTS[activePrompt].label,
        // email intentionally not included — self-service email change
        // routes through requestMyEmailChange (Supabase confirmation flow).
        phone: profileForm.phone,
        birthday: profileForm.birthday || null,
        avatarUrl,
      })
      setAvatarFile(null)
      // Edits are persisted — clear dirty so the seed effect can re-initialise
      // from the freshly-invalidated server values.
      profileDirty.current = false
      localStorage.setItem(`lobster_playtomic_check_${claimedId}`, String(Date.now()))
      setShowPlaytomicPrompt(false)
      setProfileExpanded(false)
      showToast({ variant: 'success', message: 'Profile saved.' })
    } catch (err) {
      setProfileError(errorMessage(err, 'Could not save profile.'))
    } finally {
      setProfileSaving(false)
    }
  }

  const dismissPlaytomicPrompt = () => {
    localStorage.setItem(`lobster_playtomic_check_${claimedId}`, String(Date.now()))
    setShowPlaytomicPrompt(false)
  }

  return (
    <div className="-mx-4">
      <PageHeader title="Account" />

      <div className="px-4 pt-4 space-y-6">
        {session ? (
          <>
            <ProfileSection
              myPlayer={myPlayer}
              isAdmin={isAdmin}
              hasPii={hasPii}
              profileLoadFailed={profileLoadFailed}
              email={session.user?.email ?? ''}
              profileExpanded={profileExpanded}
              openProfileEdit={() => setProfileExpanded(true)}
              cancelProfileEdit={cancelProfileEdit}
              profileForm={profileForm}
              setProfileForm={editProfileForm}
              profileSaving={profileSaving}
              profileError={profileError}
              avatarPreview={avatarPreview}
              handleAvatarChange={handleAvatarChange}
              handleProfileSave={handleProfileSave}
              activePrompt={activePrompt}
              setActivePrompt={setActivePrompt}
              showPlaytomicPrompt={showPlaytomicPrompt}
              dismissPlaytomicPrompt={dismissPlaytomicPrompt}
            />
            <AccountStatsSection claimedId={claimedId} />
            <AccountOrdersSection myPlayer={myPlayer} />
            <SignInSecuritySection />
            {isAdmin && <AdminLinks />}
          </>
        ) : (
          <AccountSection />
        )}

        <Section title="Help">
          <LobsterWayLink />
        </Section>

        {session && (
          <Button variant="neutral" fullWidth icon={<LogOut />} onClick={logout}>
            Sign out
          </Button>
        )}

        <footer className="text-center space-y-1 py-5">
          <img
            src="/logo-256.webp"
            alt="Padel Lobsters"
            width="56"
            height="56"
            className="w-14 h-14 rounded-full bg-white p-1 object-contain mx-auto mb-2"
          />
          <p className="font-bold text-lob-slate">Padel Lobsters</p>
          <p className="text-xs text-lob-muted-light">Tournament Manager · v1.0</p>
          <p className="text-xs text-lob-muted-light/60 mt-2">Made with 🦞 for the crew</p>
        </footer>
      </div>
    </div>
  )
}

function AdminLinks() {
  return (
    <Section title="Admin" icon={<Shield />}>
      <ListCard label="Admin">
        <LinkRow
          to={GROUP_SETTINGS_PATH}
          leading={
            <LinkCardIcon>
              <SettingsIcon size={16} />
            </LinkCardIcon>
          }
          title="Group settings"
          subtitle="Group name, WhatsApp link, daily tips, security log"
        />
      </ListCard>
    </Section>
  )
}
