import type { MessageRow } from '../actions'

interface Props {
  message: MessageRow
  userName: string  // the human side's name (shown under user bubbles)
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function sourceLabel(source: string): string | null {
  switch (source) {
    case 'contact_form': return 'Contact Form'
    case 'email':        return 'Email'
    default:             return null   // 'in_app' is the default channel — no label needed
  }
}

export default function MessageBubble({ message, userName }: Props) {
  const isAdmin = message.senderType === 'admin'
  const sl      = sourceLabel(message.source)
  const time    = fmtTime(message.createdAt)

  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div style={{ maxWidth: '78%' }}>

        {/* Bubble */}
        <div
          className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            backgroundColor: isAdmin ? 'var(--primary)' : 'var(--cream)',
            color:           isAdmin ? 'white'           : 'var(--foreground)',
            border:          isAdmin ? 'none'            : '1px solid var(--border)',
            // Tail on bottom-right for admin, bottom-left for user (iMessage style)
            borderRadius:    isAdmin ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          }}
        >
          {message.body}
        </div>

        {/* Below bubble: sender · time · source */}
        <div
          className={`flex items-center gap-1.5 mt-1 ${isAdmin ? 'justify-end' : 'justify-start'}`}
        >
          <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            {isAdmin ? 'Farmsy' : userName}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--border)' }}>·</span>
          <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            {time}
          </span>
          {sl && (
            <>
              <span className="text-[10px]" style={{ color: 'var(--border)' }}>·</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--muted-foreground)' }}
              >
                {sl}
              </span>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
