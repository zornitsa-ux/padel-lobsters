import React, { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  ChevronLeft,
  Trophy,
  Users,
  Calendar,
  Medal,
  Plus,
  Check,
  X,
  AlertCircle,
  Heart,
  UserPlus,
  Clock,
} from 'lucide-react'
import DateTile from '../../components/ui/DateTile'
import { letterColor } from '../../lib/letterColors'
import {
  DEFAULT_SECTIONS,
  EXPERIENCE_LEVELS,
  renderBody,
  renderTimeline,
  Countdown,
} from './leagueHelpers'
import CreateLeagueForm from './CreateLeagueForm'
import InviteModal from './InviteModal'
import Section from './Section'

// ── Main component ────────────────────────────────────────────────────────
export default function League({ onNavigate }) {
  const {
    session,
    players,
    leagues,
    leagueInterests,
    leagueTeams,
    registerLeagueInterest,
    withdrawLeagueInterest,
    respondLeagueTeam,
    deleteLeague,
    updateLeague,
    dissolveLeagueTeam,
  } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  // league_admin role no longer exists — admins manage the league.
  const canAdminLeague = isAdmin

  // Temporary testing allowlist — players whose first name matches this
  // list can preview the League page even when visibility is still 'admin'.
  // Remove or replace with the `league.visibility === 'all'` check once
  // signups open to the whole group.
  const TEST_PLAYER_FIRST_NAMES = ['zornitsa', 'jon', 'uziel']
  const meForView = claimedId ? players.find((p) => String(p.id) === String(claimedId)) : null
  const myFirstName = (meForView?.name || '').trim().split(/\s+/)[0]?.toLowerCase() || ''
  const isTestPlayer = myFirstName && TEST_PLAYER_FIRST_NAMES.includes(myFirstName)

  const [creatingLeague, setCreatingLeague] = useState(false)
  const [inviteTarget, setInviteTarget] = useState(null)
  const [myLevel, setMyLevel] = useState('intermediate')
  const [agreed, setAgreed] = useState(false)
  const [registerError, setRegisterError] = useState('')

  // For now we work with the newest league. If the admin has multiple
  // leagues in the DB we just surface the most recent signups-open one.
  const league = useMemo(() => {
    if (leagues.length === 0) return null
    // Prefer an active league (signups_open or group_stage), otherwise newest.
    const active = leagues.find((l) => l.status === 'signups_open' || l.status === 'group_stage')
    return active || leagues[0]
  }, [leagues])

  const me = claimedId ? players.find((p) => String(p.id) === String(claimedId)) : null
  const myInterest =
    league && claimedId
      ? leagueInterests.find(
          (i) =>
            String(i.league_id) === String(league.id) && String(i.player_id) === String(claimedId),
        )
      : null

  // Teams for the current league, grouped by status.
  const teamsForLeague = league
    ? leagueTeams.filter((t) => String(t.league_id) === String(league.id))
    : []
  const confirmedTeams = teamsForLeague.filter((t) => t.status === 'confirmed')
  const myPendingSent = teamsForLeague.filter(
    (t) => t.status === 'pending' && String(t.proposer_id) === String(claimedId),
  )
  const myPendingRecv = teamsForLeague.filter(
    (t) => t.status === 'pending' && String(t.invitee_id) === String(claimedId),
  )

  // Interests in my division who haven't been matched yet — the "find a
  // partner" pool. Only show players of the same division as me.
  const partnerPool =
    league && myInterest
      ? leagueInterests
          .filter(
            (i) =>
              String(i.league_id) === String(league.id) &&
              i.status === 'looking' &&
              i.division === myInterest.division &&
              String(i.player_id) !== String(claimedId),
          )
          .map((i) => {
            const p = players.find((pp) => String(pp.id) === String(i.player_id))
            return p
              ? {
                  ...p,
                  division: i.division,
                  experience_level: i.experience_level,
                  interestId: i.id,
                }
              : null
          })
          .filter(Boolean)
      : []

  const nameOf = (id) => players.find((p) => String(p.id) === String(id))?.name || '?'

  const handleRegister = async () => {
    setRegisterError('')
    if (!agreed) {
      setRegisterError('Please confirm you agree to the league rules')
      return
    }
    const { error, division } = await registerLeagueInterest(league.id, myLevel)
    if (error) setRegisterError(error.message || 'Could not register interest')
  }

  // ── Early returns ────────────────────────────────────────────────────────
  // Gate: full admin, scoped league admin, or a whitelisted test player.
  // Once signup opens to everyone the test-player check is redundant —
  // we'll switch this to checking league.visibility === 'all' instead.
  if (!canAdminLeague && !isTestPlayer) {
    return (
      <div className="card py-10 text-center text-gray-400">
        <Trophy size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Leagues coming soon!</p>
        <button
          onClick={() => onNavigate?.('tournament')}
          className="btn-primary mt-4 py-2 px-5 text-sm"
        >
          Back to Events
        </button>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="space-y-4">
        <div>
          <button
            onClick={() => onNavigate?.('tournament')}
            className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2"
          >
            <ChevronLeft size={16} /> Events
          </button>
          <h2 className="text-lg font-bold text-gray-800">Lobster League</h2>
          <p className="text-sm text-gray-500">
            No league set up yet. Create one to open sign-ups.
          </p>
        </div>
        {creatingLeague ? (
          <CreateLeagueForm
            onCancel={() => setCreatingLeague(false)}
            onCreated={() => setCreatingLeague(false)}
          />
        ) : (
          <button
            onClick={() => setCreatingLeague(true)}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            <Plus size={16} /> Create a league
          </button>
        )}
      </div>
    )
  }

  const signupClosed =
    league.signup_closes_at && new Date(league.signup_closes_at).getTime() < Date.now()

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div>
        <button
          onClick={() => onNavigate?.('tournament')}
          className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2"
        >
          <ChevronLeft size={16} /> Events
        </button>
        <div className="rounded-3xl bg-gradient-to-br from-lobster-teal to-teal-700 text-white p-5 shadow-md">
          {/* Header row: DateTile (first playing day) + title + subtitle.
              Matches the layout used on Tournament.jsx event cards so the
              visual grammar is consistent across the two event types. */}
          <div className="flex items-start gap-3 mb-3">
            {(() => {
              // Anchor the tile to the first meaningful day of the league:
              // group stage start if set, otherwise the sign-up deadline.
              const tileDate =
                league.group_stage_start ||
                (league.signup_closes_at
                  ? new Date(league.signup_closes_at).toISOString().slice(0, 10)
                  : null) ||
                league.starts_at
              return tileDate ? <DateTile date={tileDate} size="md" /> : null
            })()}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                Lobster League
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold leading-tight">{league.name}</h1>
              {(() => {
                // Full season range: group stage start → finals end. Show
                // whichever endpoints are defined; omit gracefully if both
                // are blank.
                const rangeStart = league.group_stage_start || league.starts_at
                const rangeEnd = league.finals_end || league.ends_at
                if (!rangeStart && !rangeEnd) return null
                const fmt = (d) =>
                  d
                    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : '…'
                return (
                  <p className="text-sm font-semibold mt-1 flex items-center gap-1 opacity-90">
                    <Calendar size={13} /> {fmt(rangeStart)} – {fmt(rangeEnd)}
                  </p>
                )
              })()}
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Users size={14} /> <span>{confirmedTeams.length} teams confirmed</span>
          </div>
          {league.signup_closes_at && (
            <p className="mt-2 text-xs bg-yellow-300 text-gray-900 inline-block px-3 py-1 rounded-full font-semibold shadow-sm">
              Sign-up closes on{' '}
              {new Date(league.signup_closes_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
              {' · '}
              <Countdown deadline={league.signup_closes_at} />
            </p>
          )}
        </div>
      </div>

      {/* Admin controls — either a full admin or the scoped league admin */}
      {canAdminLeague && (
        <details className="bg-gray-50 border border-gray-200 rounded-2xl">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-700">
            ⚙️ Admin controls
          </summary>
          <div className="p-3 space-y-2">
            <p className="text-[11px] text-gray-500">
              Visibility: <span className="font-semibold">{league.visibility || 'admin'}</span>{' '}
              (players won't see this until you flip to "all").
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() =>
                  updateLeague(league.id, {
                    visibility: league.visibility === 'all' ? 'admin' : 'all',
                  })
                }
                className="text-xs font-semibold px-3 py-1.5 bg-white border border-gray-200 rounded-lg"
              >
                Toggle visibility → {league.visibility === 'all' ? 'admin only' : 'all players'}
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this league and all its sign-ups + teams?'))
                    deleteLeague(league.id)
                }}
                className="text-xs font-semibold px-3 py-1.5 text-red-600 border border-red-200 rounded-lg"
              >
                Delete league
              </button>
            </div>
            <p className="text-[11px] text-gray-500 pt-2 border-t border-gray-100">
              {leagueInterests.filter((i) => String(i.league_id) === String(league.id)).length}{' '}
              interests registered
              {' · '}
              {teamsForLeague.filter((t) => t.status === 'pending').length} pending invites
              {' · '}
              {confirmedTeams.length} teams confirmed
            </p>
          </div>
        </details>
      )}

      {/* Admin overview — all sign-ups across both divisions, grouped by
          division, showing each player's status (looking vs matched) plus
          their partner + team name when matched. Only visible to admins /
          league admins, so it stays out of players' way.
      */}
      {canAdminLeague &&
        (() => {
          const all = leagueInterests.filter((i) => String(i.league_id) === String(league.id))
          if (all.length === 0) return null
          const byDivision = all.reduce((acc, i) => {
            ;(acc[i.division] ??= []).push(i)
            return acc
          }, {})
          // Stable division ordering: Men's, Women's, Open (if present).
          const divOrder = ['mens', 'womens', 'open']
          const divLabel = (d) =>
            d === 'mens' ? "Men's Division" : d === 'womens' ? "Women's Division" : 'Open Division'

          // Quick lookup: for each matched player, find the confirmed team
          // so we can show "paired with X — Team Y".
          const teamForPlayer = (pid) =>
            confirmedTeams.find(
              (t) => String(t.proposer_id) === String(pid) || String(t.invitee_id) === String(pid),
            )

          return (
            <details className="bg-white border border-gray-200 rounded-2xl" open>
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span>🔍 Admin overview — all sign-ups</span>
                <span className="text-[11px] font-normal text-gray-400">{all.length} total</span>
              </summary>
              <div className="p-3 space-y-4 border-t border-gray-100">
                {divOrder
                  .filter((d) => byDivision[d]?.length)
                  .map((d) => {
                    const rows = byDivision[d]
                    const looking = rows.filter((r) => r.status === 'looking')
                    const matched = rows.filter((r) => r.status === 'matched')
                    const withdrew = rows.filter((r) => r.status === 'withdrawn')
                    return (
                      <div key={d} className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-lobster-teal">
                          {divLabel(d)}{' '}
                          <span className="text-gray-400 font-normal">({rows.length})</span>
                        </p>

                        {/* Matched pairs — one row per team instead of one row
                        per player, so "Jon & Uziel · Team The Claws"
                        appears once rather than duplicated for each side. */}
                        {matched.length > 0 &&
                          (() => {
                            // Gather distinct teams in this division where both
                            // players are in the `matched` bucket. Use a Set on
                            // team id to de-duplicate.
                            const seen = new Set()
                            const teamsInDiv = []
                            matched.forEach((r) => {
                              const t = teamForPlayer(r.player_id)
                              if (t && !seen.has(t.id)) {
                                seen.add(t.id)
                                teamsInDiv.push(t)
                              }
                            })
                            return (
                              <div className="space-y-1">
                                {teamsInDiv.map((t) => (
                                  <div
                                    key={t.id}
                                    className="flex items-center gap-2 text-xs bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5"
                                  >
                                    <Check size={12} className="text-green-600 flex-shrink-0" />
                                    <span className="flex-1 min-w-0 truncate">
                                      <span className="font-semibold text-gray-800">
                                        {nameOf(t.proposer_id)} & {nameOf(t.invitee_id)}
                                      </span>
                                      <span className="text-green-700 font-semibold">
                                        {' '}
                                        · Team {t.team_name}
                                      </span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}

                        {/* Still looking — admin may want to nudge them */}
                        {looking.length > 0 && (
                          <div className="space-y-1">
                            {looking.map((r) => {
                              const p = players.find((pp) => String(pp.id) === String(r.player_id))
                              return (
                                <div
                                  key={r.id}
                                  className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5"
                                >
                                  <Clock size={12} className="text-amber-600 flex-shrink-0" />
                                  <span className="flex-1 min-w-0 truncate">
                                    <span className="font-semibold text-gray-800">
                                      {p?.name || '?'}
                                    </span>
                                    {' — looking for a partner'}
                                    {r.experience_level && (
                                      <span className="text-gray-500"> · {r.experience_level}</span>
                                    )}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Withdrew — greyed so admin knows they're no longer in */}
                        {withdrew.length > 0 && (
                          <div className="space-y-1 opacity-60">
                            {withdrew.map((r) => {
                              const p = players.find((pp) => String(pp.id) === String(r.player_id))
                              return (
                                <div
                                  key={r.id}
                                  className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5"
                                >
                                  <X size={12} className="text-gray-400 flex-shrink-0" />
                                  <span className="flex-1 min-w-0 truncate">
                                    <span className="font-semibold text-gray-500 line-through">
                                      {p?.name || '?'}
                                    </span>
                                    {' — withdrew'}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </details>
          )
        })()}

      {/* Pending invites TO me — top priority, so I can act on them */}
      {myPendingRecv.length > 0 && (
        <div className="space-y-2">
          {myPendingRecv.map((t) => (
            <div key={t.id} className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-yellow-900">
                💌 {nameOf(t.proposer_id)?.split(' ')[0]} wants to team up
              </p>
              <p className="text-xs text-yellow-800 mt-1">
                Proposed team: <span className="font-semibold">{t.team_name}</span>
                {t.team_song ? (
                  <>
                    {' '}
                    · song: <em>{t.team_song}</em>
                  </>
                ) : null}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => respondLeagueTeam(t.id, true)}
                  className="flex-1 bg-green-600 text-white text-sm font-bold py-2 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  <Check size={14} /> Accept
                </button>
                <button
                  onClick={() => respondLeagueTeam(t.id, false)}
                  className="flex-1 bg-white border border-red-200 text-red-600 text-sm font-semibold py-2 rounded-xl active:scale-95 transition-all"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* A player is treated as "not in the league" both when they've
          never registered (myInterest is undefined) and when they
          previously withdrew (status === 'withdrawn') — in both cases
          we want to show the register card so they can join / re-join. */}
      {(() => {
        const needsSignup = !myInterest || myInterest.status === 'withdrawn'
        if (!needsSignup || signupClosed) return null
        if (!claimedId) {
          return (
            <div className="card bg-lobster-cream border border-lobster-teal/30">
              <p className="text-sm font-bold text-lobster-teal flex items-center gap-2">
                <AlertCircle size={16} /> Signed in as admin, not as a player
              </p>
              <p className="text-xs text-gray-600 mt-2 leading-snug">
                Admin PIN and player PIN are separate identities. If you want to register{' '}
                <em>yourself</em> for the league, sign out from Settings → Account and sign in again
                with your personal player PIN. Admin access comes back automatically when you use
                the admin PIN.
              </p>
            </div>
          )
        }
        return null
      })()}

      {/* Status: not yet interested OR previously withdrew — show sign-up card. */}
      {(!myInterest || myInterest.status === 'withdrawn') && !signupClosed && claimedId && (
        <div className="card space-y-3">
          <p className="font-bold text-gray-700 flex items-center gap-2">
            <Heart size={16} className="text-lobster-teal" />
            {myInterest?.status === 'withdrawn'
              ? 'Changed your mind? Register again'
              : 'Register your interest'}
          </p>
          <p className="text-xs text-gray-500">
            {myInterest?.status === 'withdrawn'
              ? "You previously withdrew — no problem. Pick a level and register again; we'll plug you back into the partner pool."
              : 'Step 1: tell us you want to play. Step 2: once your partner has also registered, you\'ll be able to team up from the "Find a partner" section.'}
          </p>
          <div>
            <label className="label">Experience level</label>
            <div className="space-y-2">
              {EXPERIENCE_LEVELS.map((lvl) => (
                <label
                  key={lvl.id}
                  className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                    myLevel === lvl.id
                      ? 'border-lobster-teal bg-lobster-cream'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="level"
                    checked={myLevel === lvl.id}
                    onChange={() => setMyLevel(lvl.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{lvl.label}</p>
                    <p className="text-xs text-gray-500">{lvl.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>I've read the league rules and agree to the code of conduct.</span>
          </label>
          {registerError && <p className="text-xs text-red-500">{registerError}</p>}
          <button
            onClick={handleRegister}
            disabled={!agreed}
            className="w-full py-3 rounded-2xl font-bold text-base text-white bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:hover:bg-orange-500"
          >
            <UserPlus size={16} />
            {myInterest?.status === 'withdrawn'
              ? 'Count me back in'
              : "I'm interested — register me"}
          </button>
        </div>
      )}

      {/* Status: interested, looking for a partner */}
      {myInterest && myInterest.status === 'looking' && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
            <Check size={16} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 flex-1">
              You're on the list (
              {myInterest.division === 'mens'
                ? "Men's"
                : myInterest.division === 'womens'
                  ? "Women's"
                  : 'Open'}{' '}
              Division
              {' · '}
              {myInterest.experience_level}). Now find a partner below.
            </p>
            <button
              onClick={() => withdrawLeagueInterest(league.id)}
              className="text-[11px] font-semibold text-green-700 underline"
            >
              Withdraw
            </button>
          </div>

          <div className="card space-y-3">
            <p className="font-bold text-gray-700">🤝 Find a partner</p>
            {partnerPool.length === 0 ? (
              <p className="text-sm text-gray-400">
                No other Lobsters in your division yet — check back as more people register.
              </p>
            ) : (
              partnerPool.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: letterColor(p.name) }}
                  >
                    {(p.name || '')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-500">{p.experience_level}</p>
                  </div>
                  {myPendingSent.find((t) => String(t.invitee_id) === String(p.id)) ? (
                    <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full flex items-center gap-1">
                      <Clock size={10} /> Invite sent
                    </span>
                  ) : (
                    <button
                      onClick={() => setInviteTarget(p)}
                      className="text-xs font-semibold text-white bg-lobster-teal px-3 py-1.5 rounded-lg active:scale-95"
                    >
                      Invite
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Status: matched — show our team card */}
      {myInterest &&
        myInterest.status === 'matched' &&
        (() => {
          const myTeam = confirmedTeams.find(
            (t) =>
              String(t.proposer_id) === String(claimedId) ||
              String(t.invitee_id) === String(claimedId),
          )
          if (!myTeam) return null
          const partnerId =
            String(myTeam.proposer_id) === String(claimedId)
              ? myTeam.invitee_id
              : myTeam.proposer_id
          return (
            <div className="rounded-3xl p-5 bg-gradient-to-br from-yellow-300 to-amber-400 text-gray-900 shadow-md">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-900 mb-1">
                You're in!
              </p>
              <h3 className="text-2xl font-extrabold leading-tight">Team {myTeam.team_name}</h3>
              <p className="text-sm font-semibold mt-1">
                {me?.name?.split(' ')[0]} & {nameOf(partnerId)?.split(' ')[0]}
              </p>
              {myTeam.team_song && <p className="text-xs mt-2 italic">🎵 {myTeam.team_song}</p>}
            </div>
          )
        })()}

      {/* Confirmed teams — everyone's teams, for social proof + scanning */}
      {confirmedTeams.length > 0 && (
        <div className="card space-y-2">
          <p className="font-bold text-gray-700">🏆 Teams confirmed ({confirmedTeams.length})</p>
          <div className="space-y-1.5">
            {confirmedTeams.map((t) => (
              <div key={t.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                <Medal size={14} className="text-lobster-teal flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    Team {t.team_name}{' '}
                    <span className="text-xs text-gray-400 font-normal">
                      (
                      {t.division === 'mens'
                        ? "Men's"
                        : t.division === 'womens'
                          ? "Women's"
                          : 'Open'}
                      )
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {nameOf(t.proposer_id)?.split(' ')[0]} & {nameOf(t.invitee_id)?.split(' ')[0]}
                    {t.team_song ? <> · 🎵 {t.team_song}</> : null}
                  </p>
                </div>
                {canAdminLeague && (
                  <button
                    onClick={() => {
                      if (confirm(`Dissolve Team ${t.team_name}?`)) dissolveLeagueTeam(t.id)
                    }}
                    className="text-[11px] font-semibold text-red-500 px-2"
                  >
                    Dissolve
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible info sections — findable but not shouting once read.
          The Timeline section is special: it always renders from the
          phase-date columns when they're filled in. All other sections
          read their body from league.description_sections[id] if the
          admin has customised it, else fall back to DEFAULT_SECTIONS.
          Admins see a pencil icon on each editable section. */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-4 mb-1">
          About the league
        </p>
        {DEFAULT_SECTIONS.map((s, i) => {
          const dynamicTimeline = s.id === 'timeline' ? renderTimeline(league) : null
          const customBody = league.description_sections?.[s.id]
          // What the user sees on-screen right now. When editing, the
          // textarea is pre-filled with this so the admin is tweaking
          // the actual copy rather than starting from a blank page.
          const effectiveBody = (customBody && customBody.trim()) || s.body
          const saveSection = async (newBody) => {
            const next = { ...(league.description_sections || {}) }
            const trimmed = (newBody || '').trim()
            // Blank OR identical to the default → drop the override so
            // the section falls back to the hardcoded DEFAULT_SECTIONS
            // copy and any future default updates show up automatically.
            if (!trimmed || trimmed === s.body.trim()) delete next[s.id]
            else next[s.id] = newBody
            await updateLeague(league.id, { description_sections: next })
          }
          return (
            <Section
              key={s.id}
              id={s.id}
              icon={s.icon}
              title={s.title}
              defaultOpen={i === 0 && !myInterest}
              editable={canAdminLeague && s.id !== 'timeline'}
              currentBody={effectiveBody}
              onSave={saveSection}
            >
              {dynamicTimeline || renderBody(effectiveBody)}
            </Section>
          )
        })}
        {canAdminLeague && (
          <p className="text-[10px] text-gray-400 mt-2">
            Tap the pencil on any section to edit its copy inline. Leave blank to revert to the
            default. Timeline auto-builds from the phase dates you saved on the league.
          </p>
        )}
      </div>

      {/* Invite modal */}
      <InviteModal
        league={league}
        invitee={inviteTarget}
        onClose={() => setInviteTarget(null)}
        onSent={() => setInviteTarget(null)}
      />
    </div>
  )
}
