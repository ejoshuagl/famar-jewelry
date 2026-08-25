'use client'

import { useEffect, useState } from 'react'

const SNOWFLAKES = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${-((index * 1.7) % 12)}s`,
  duration: `${10 + (index % 7)}s`,
  size: `${5 + (index % 4) * 2}px`,
}))

const LIGHTS = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${2 + index * 5.6}%`,
  delay: `${(index % 6) * 0.22}s`,
  color: ['gold', 'red', 'green', 'warm'][index % 4],
}))

const STARS = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  left: `${4 + ((index * 29) % 91)}%`,
  top: `${14 + ((index * 17) % 74)}%`,
  delay: `${(index % 5) * 0.6}s`,
}))

type SeasonalTheme = 'christmas' | 'halloween' | 'black-friday' | 'valentine'

const CLICK_SYMBOLS: Record<SeasonalTheme, string[]> = {
  christmas: ['✦', '❄', '✧'],
  halloween: ['✦', '◆', '☾'],
  'black-friday': ['%', '✦', 'SALE'],
  valentine: ['♥', '♡', '✦'],
}

function ThemeClickEffects({ theme }: { theme: SeasonalTheme }) {
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; symbols: string[] }>>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let nextId = 0
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('button, a, [role="button"]')) return
      const id = nextId++
      setBursts((current) => [...current.slice(-3), { id, x: event.clientX, y: event.clientY, symbols: CLICK_SYMBOLS[theme] }])
      window.setTimeout(() => setBursts((current) => current.filter((burst) => burst.id !== id)), 850)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [theme])

  return (
    <div className={`theme-click-effects theme-click-${theme}`} aria-hidden="true">
      {bursts.flatMap((burst) => burst.symbols.map((symbol, index) => (
        <i key={`${burst.id}-${index}`} style={{ left: burst.x, top: burst.y, '--burst-index': index } as React.CSSProperties}>{symbol}</i>
      )))}
    </div>
  )
}

export function SiteTheme() {
  const [theme, setTheme] = useState<'standard' | 'christmas' | 'halloween' | 'black-friday' | 'valentine'>('standard')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/theme', { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setTheme(['christmas', 'halloween', 'black-friday', 'valentine'].includes(data.theme) ? data.theme : 'standard'))
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('Error loading theme:', error)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.siteTheme = theme
    return () => { delete document.documentElement.dataset.siteTheme }
  }, [theme])

  if (theme === 'standard') return null

  if (theme !== 'christmas') {
    const decorations = {
      halloween: ['☾', '✦', '◆', '✧', '☾', '✦', '◆', '✧'],
      'black-friday': ['%', '✦', '%', '◆', '%', '✦', '%', '◆'],
      valentine: ['♥', '✦', '♡', '♥', '✧', '♡', '♥', '✦'],
    }[theme]

    return (
      <>
        <div className={`seasonal-decorations seasonal-${theme}`} aria-hidden="true">
          <div className="seasonal-top-accent" />
          {decorations.map((symbol, index) => (
            <i
              key={`${symbol}-${index}`}
              style={{ left: `${4 + ((index * 29) % 91)}%`, animationDelay: `${index * -0.7}s`, animationDuration: `${7 + (index % 4)}s` }}
            >{symbol}</i>
          ))}
          {theme === 'halloween' ? (
            <>
              <span className="halloween-spider spider-one">🕷</span>
              <span className="halloween-spider spider-two">🕷</span>
              <span className="halloween-ghost ghost-one">👻</span>
              <span className="halloween-ghost ghost-two">👻</span>
              <span className="halloween-bat">
                <svg viewBox="0 0 64 32" role="presentation">
                  <path d="M32 12c-3-4-6-5-9-4C19 4 14 2 8 2c4 6 3 11-4 16 8-1 13 2 17 8 3-4 7-6 11-5 4-1 8 1 11 5 4-6 9-9 17-8-7-5-8-10-4-16-6 0-11 2-15 6-3-1-6 0-9 4Z" />
                  <circle cx="28.5" cy="14" r="1" />
                  <circle cx="35.5" cy="14" r="1" />
                </svg>
              </span>
            </>
          ) : null}
        </div>
        <ThemeClickEffects theme={theme} />
      </>
    )
  }

  return (
    <>
    <div className="christmas-decorations" aria-hidden="true">
      <div className="christmas-light-wire">
        {LIGHTS.map((light) => (
          <i key={light.id} className={`christmas-light christmas-light-${light.color}`} style={{ left: light.left, animationDelay: light.delay }} />
        ))}
      </div>
      <div className="christmas-stars">
        {STARS.map((star) => (
          <i key={star.id} style={{ left: star.left, top: star.top, animationDelay: star.delay }}>✦</i>
        ))}
      </div>
      <div className="christmas-ornament christmas-ornament-left"><i /><b /></div>
      <div className="christmas-ornament christmas-ornament-right"><i /><b /></div>
      <div className="christmas-snow">
        {SNOWFLAKES.map((flake) => (
          <span
            key={flake.id}
            style={{ left: flake.left, animationDelay: flake.delay, animationDuration: flake.duration, width: flake.size, height: flake.size }}
          />
        ))}
      </div>
    </div>
    <ThemeClickEffects theme="christmas" />
    </>
  )
}
