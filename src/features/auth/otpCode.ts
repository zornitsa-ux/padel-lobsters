export const CODE_LENGTH = 6

export const sanitiseCode = ({ value }: { value: string }): string =>
  value.replace(/\D/g, '').slice(0, CODE_LENGTH)
