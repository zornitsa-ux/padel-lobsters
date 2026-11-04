import { LogIn } from 'lucide-react'
import SignInForm from '../auth/SignInForm'
import { Section } from '../../components/ui/Section'

/** The signed-out Account page: one sign-in for the whole site. */
export default function AccountSection() {
  return (
    <Section
      title="Sign in"
      icon={<LogIn />}
      description="We'll email you a 6-digit code. No password needed."
    >
      <div className="card">
        <SignInForm variant="inline" allowPin={false} />
      </div>
    </Section>
  )
}
