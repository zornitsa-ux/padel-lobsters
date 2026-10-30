/** The admin's confirm before changing a player's payment, shared by Payments and the post-add sheet. */
export const paymentChangeConfirm = ({ name, change }: { name: string; change: string }) => ({
  title: 'Update payment?',
  lines: [`Player: ${name}`, `Change: ${change}`],
  confirmLabel: 'Update payment',
  footer: 'Check this is the right payment before you continue.',
})
