import { Link } from 'react-router-dom'

export function LeagueNotFound() {
  return (
    <div className="flex flex-col items-center py-16 text-center gap-3">
      <span className="text-5xl">🦞</span>
      <p className="font-bold text-lob-dark">League not found</p>
      <Link to="/league" className="text-sm text-lob-teal">
        View all seasons →
      </Link>
    </div>
  )
}
