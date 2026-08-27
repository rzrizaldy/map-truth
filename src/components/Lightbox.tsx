import { useEffect, type ReactNode } from 'react'

type LightboxProps = {
  title: string
  caption?: string
  onClose: () => void
  children: ReactNode
}

export function Lightbox({ title, caption, onClose, children }: LightboxProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Stop the page scrolling underneath while the overlay is open.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="lightbox-bar">
        <div>
          <strong>{title}</strong>
          {caption ? <span>{caption}</span> : null}
        </div>
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close full screen">Close ✕</button>
      </div>
      <div className="lightbox-stage" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
