const LOGO_URL =
  'https://enjhugmqjtfakwivpmvf.supabase.co/storage/v1/object/public/merch/logo-hd.png'

const BODY_TEXT = 'margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #4a5568'
const FOOT_TEXT = 'margin: 0; font-size: 13px; color: #6b8a92; line-height: 1.5'

const confirmUrl = ({ type, next }) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`

const codeBlock = ({
  codeLabel,
}) => `<p style="margin: 0 0 6px; font-size: 12px; color: #6b8a92; letter-spacing: 0.08em; text-transform: uppercase;">
    ${codeLabel}
  </p>
  <p style="margin: 0 0 24px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 34px; font-weight: 700; letter-spacing: 0.25em; color: #1c2b30;">
    {{ .Token }}
  </p>`

const buttonIntro = ({ buttonIntro }) =>
  buttonIntro
    ? `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #4a5568">${buttonIntro}</p>`
    : ''

const button = ({
  link,
  buttonLabel,
}) => `<table cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px">
    <tr>
      <td style="background: #d94f2b; border-radius: 8px">
        <a href="${confirmUrl(link)}" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
          ${buttonLabel} &rarr;
        </a>
      </td>
    </tr>
  </table>`

const linkFallback = ({
  link,
  wrapLinkText,
}) => `Or copy and paste this link into your browser:<br />
  <a href="${confirmUrl(link)}" style="color: #d94f2b; text-decoration: underline;${wrapLinkText ? ' word-break: break-all' : ''}">${confirmUrl(link)}</a>`

const header = `<tr>
    <td style="background: #3d7a8a; border-radius: 12px 12px 0 0; padding: 32px 32px 24px; text-align: center;">
      <img src="${LOGO_URL}" alt="Padel Lobsters" width="80" height="80" style="border-radius: 50%; background: #fff; padding: 4px; border: 3px solid #8ab4be; display: block; margin: 0 auto 12px;" />
      <p style="margin: 0; color: #c2d8dd; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;">
        Padel Lobsters
      </p>
    </td>
  </tr>`

const footer = `<tr>
    <td style="background: #e8e4dc; border-radius: 0 0 12px 12px; padding: 16px 32px; text-align: center; border: 1px solid #e0d8cc; border-top: none;">
      <p style="margin: 0; font-size: 14px; color: #6b8a92">🦞 ❤️</p>
    </td>
  </tr>`

const body = (
  copy,
) => `<h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #1c2b30">${copy.heading}</h1>
  <p style="${BODY_TEXT}">${copy.intro}</p>
  ${[copy.codeLabel && codeBlock(copy), copy.codeLabel && buttonIntro(copy), copy.link && button(copy)].filter(Boolean).join('\n')}
  <p style="${FOOT_TEXT}">${copy.footnote}${copy.link ? '\n' + linkFallback(copy) : ''}</p>`

// GoTrue can't share partials, so each template is this layout plus its copy.
// Prettier then formats the output exactly as `npm run format` formats the committed files.
export const renderSource = (copy) => `<!--
${copy.comment}
-->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${copy.title}</title>
  </head>
  <body>
    <div style="margin: 0; padding: 0; background-color: #f5f0e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f0e8">
        <tr>
          <td align="center" style="padding: 32px 16px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px">
              <!-- Header -->
              ${header}

              <!-- Body -->
              <tr>
                <td style="background: #ffffff; padding: 36px 32px 28px; border-left: 1px solid #e8e0d4; border-right: 1px solid #e8e0d4;">
                  ${body(copy)}
                </td>
              </tr>

              <!-- Footer -->
              ${footer}
            </table>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>
`
