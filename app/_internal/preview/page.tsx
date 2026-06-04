'use client';

import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Badge,
  Icon,
  Input,
  Wordmark,
  WordReveal,
  Marquee,
  BottleSVG,
} from '@/components/ui';
import { MR_SPRING } from '@/lib/motion/presets';

/**
 * DESIGN SYSTEM KITCHEN SINK
 *
 * This page showcases all UI primitives with their motion states,
 * color tokens, and interactive behaviors.
 *
 * Used for design handoff, frontend-implementer reference, and motion QA.
 */

export default function PreviewPage() {
  const [cartOpen, setCartOpen] = useState(false);
  const [notification, setNotification] = useState('');

  return (
    <div className="min-h-screen bg-[--mr-bg] text-[--mr-fg]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[--mr-hairline] bg-[--mr-bg-raised]/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif text-[--mr-fg]">
            MiniRue Design System
          </h1>
          <nav className="flex gap-6 text-sm">
            <a href="#colors" className="text-[--mr-fg-3] hover:text-[--mr-fg]">
              Colors
            </a>
            <a href="#typography" className="text-[--mr-fg-3] hover:text-[--mr-fg]">
              Typography
            </a>
            <a href="#buttons" className="text-[--mr-fg-3] hover:text-[--mr-fg]">
              Buttons
            </a>
            <a href="#inputs" className="text-[--mr-fg-3] hover:text-[--mr-fg]">
              Inputs
            </a>
            <a href="#motion" className="text-[--mr-fg-3] hover:text-[--mr-fg]">
              Motion
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        {/* Hero Section */}
        <section className="mb-24">
          <div className="space-y-6">
            <Wordmark />
            <p className="text-lg text-[--mr-fg-2] max-w-2xl">
              Premium luxury perfume and cosmetics e-commerce platform. Built with
              iOS-inspired spring physics, editorial typography, and intentional restraint.
            </p>
          </div>
        </section>

        {/* Colors */}
        <section id="colors" className="mb-24">
          <h2 className="text-3xl font-serif mb-8">Color Palette</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { name: 'Gold 900', var: '--mr-gold-900', bg: '#6B5526' },
              { name: 'Gold 700', var: '--mr-gold-700', bg: '#846432' },
              { name: 'Gold 500', var: '--mr-gold-500', bg: '#95783C' },
              { name: 'Gold 400', var: '--mr-gold-400', bg: '#B0924F' },
              { name: 'Cream 100', var: '--mr-cream-100', bg: '#FDFBF5' },
              { name: 'Cream 200', var: '--mr-cream-200', bg: '#F6F2E9' },
              { name: 'Ink 900', var: '--mr-ink-900', bg: '#0B0B0B' },
              { name: 'Crimson 700', var: '--mr-crimson-700', bg: '#670003' },
            ].map((color) => (
              <div key={color.var} className="space-y-2">
                <div
                  className="h-24 rounded-lg border border-[--mr-hairline] shadow-sm"
                  style={{ backgroundColor: color.bg }}
                />
                <div>
                  <p className="font-label text-xs font-semibold uppercase tracking-wide">
                    {color.name}
                  </p>
                  <code className="text-xs text-[--mr-fg-3]">{color.var}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section id="typography" className="mb-24">
          <h2 className="text-3xl font-serif mb-8">Typography</h2>

          <div className="space-y-8">
            <div>
              <p className="text-6xl font-serif mb-2">H1 Display</p>
              <p className="text-sm text-[--mr-fg-3]">
                Cormorant Garamond, 64px, editorial & hero
              </p>
            </div>

            <div>
              <p className="text-4xl font-serif mb-2">H2 Headline</p>
              <p className="text-sm text-[--mr-fg-3]">Cormorant Garamond, 46px</p>
            </div>

            <div>
              <p className="text-xl font-label font-semibold uppercase tracking-wide mb-2">
                Label / Caption
              </p>
              <p className="text-sm text-[--mr-fg-3]">
                Jost, 15px, all-caps, 0.6em tracking
              </p>
            </div>

            <div>
              <p className="text-base text-[--mr-fg-2] mb-2">Body text</p>
              <p className="text-sm text-[--mr-fg-3]">
                Inter Tight, 15px, form & prose. Readable on both cream & ink
                backgrounds.
              </p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section id="buttons" className="mb-24">
          <h2 className="text-3xl font-serif mb-8">Buttons & Interactions</h2>

          <div className="space-y-12">
            {/* Primary */}
            <div>
              <h3 className="font-label text-sm font-semibold uppercase tracking-wide mb-4 text-[--mr-fg-3]">
                Primary Button (Crimson)
              </h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="primary">Shop Now</Button>
                <Button variant="primary" disabled>
                  Disabled
                </Button>
              </div>
            </div>

            {/* Gold */}
            <div>
              <h3 className="font-label text-sm font-semibold uppercase tracking-wide mb-4 text-[--mr-fg-3]">
                Gold Button
              </h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="gold">Learn More</Button>
                <Button variant="gold" disabled>
                  Disabled
                </Button>
              </div>
            </div>

            {/* Icon Buttons */}
            <div>
              <h3 className="font-label text-sm font-semibold uppercase tracking-wide mb-4 text-[--mr-fg-3]">
                Icon Buttons
              </h3>
              <div className="flex gap-4">
                <IconButton
                  icon="heart"
                  label="Add to wishlist"
                  onClick={() => setNotification('Added to wishlist')}
                />
                <IconButton
                  icon="shopping-bag"
                  label="Open cart"
                  onClick={() => {
                    setCartOpen(!cartOpen);
                    setNotification('Cart opened');
                  }}
                />
                <IconButton
                  icon="settings"
                  label="Settings"
                  onClick={() => setNotification('Settings')}
                />
              </div>
            </div>

            {/* Motion Info */}
            <div className="rounded-lg border border-[--mr-hairline] bg-[--mr-bg-raised] p-6">
              <h4 className="font-label text-sm font-semibold uppercase tracking-wide mb-3">
                Motion Rules
              </h4>
              <ul className="space-y-2 text-sm text-[--mr-fg-2]">
                <li>
                  <strong>Hover:</strong> scale(1.02) 200ms ease-spring
                </li>
                <li>
                  <strong>Press:</strong> scale(0.96) 80ms ease-snappy
                </li>
                <li>
                  <strong>Release:</strong> spring return to 1.0 (default preset)
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Inputs */}
        <section id="inputs" className="mb-24">
          <h2 className="text-3xl font-serif mb-8">Form Inputs</h2>

          <div className="max-w-md space-y-6">
            <div>
              <label className="font-label text-xs font-semibold uppercase tracking-wide block mb-2">
                Email Address
              </label>
              <Input id="email" type="email" placeholder="name@example.com" />
            </div>

            <div>
              <label className="font-label text-xs font-semibold uppercase tracking-wide block mb-2">
                Password
              </label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>

            <div>
              <label className="font-label text-xs font-semibold uppercase tracking-wide block mb-2">
                Search Products
              </label>
              <Input id="search" placeholder="Enter fragrance name..." />
            </div>

            <div className="rounded-lg border border-[--mr-hairline] bg-[--mr-bg-raised] p-6">
              <h4 className="font-label text-sm font-semibold uppercase tracking-wide mb-3">
                Motion Rules
              </h4>
              <ul className="space-y-2 text-sm text-[--mr-fg-2]">
                <li>
                  <strong>Focus ring:</strong> scale(0.98→1), opacity 0→1, 150ms
                  ease-spring
                </li>
                <li>
                  <strong>Error state:</strong> translateX oscillate ±4px, 400ms
                </li>
                <li>
                  <strong>Placeholder:</strong> fade out on focus
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="mb-24">
          <h2 className="text-3xl font-serif mb-8">Badges & Labels</h2>

          <div className="flex flex-wrap gap-3">
            <Badge kind="new">New</Badge>
            <Badge kind="sale">Sale</Badge>
            <Badge kind="gold">Premium</Badge>
            <Badge kind="outline">Limited Edition</Badge>
          </div>
        </section>

        {/* Motion Presets */}
        <section id="motion" className="mb-24">
          <h2 className="text-3xl font-serif mb-8">iOS Spring Presets</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(MR_SPRING).map(([name, config]) => (
              <div
                key={name}
                className="rounded-lg border border-[--mr-hairline] bg-[--mr-bg-raised] p-6"
              >
                <h4 className="font-label text-sm font-semibold uppercase tracking-wide mb-3 capitalize">
                  {name}
                </h4>
                <div className="space-y-1 text-sm font-mono text-[--mr-fg-3] mb-4">
                  <p>stiffness: {config.stiffness}</p>
                  <p>damping: {config.damping}</p>
                  <p>mass: {config.mass}</p>
                </div>
                <div className="bg-[--mr-bg] rounded p-3 text-xs">
                  <p className="text-[--mr-fg-3] italic">
                    {name === 'default'
                      ? 'Sheet / modal — most "Apple"'
                      : name === 'interactive'
                        ? 'Gesture / tap — instant feel'
                        : name === 'navigation'
                          ? 'Push / navigate'
                          : name === 'popover'
                            ? 'Dropdown / menu'
                            : name === 'sheet'
                              ? 'Bottom sheet snap'
                              : name === 'bouncy'
                                ? 'Celebration / delight'
                                : name === 'banner'
                                  ? 'Toast / notification'
                                  : 'Slow, restrained'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-[--mr-hairline] bg-[--mr-bg-raised] p-6">
            <h4 className="font-label text-sm font-semibold uppercase tracking-wide mb-3">
              CSS Easing Tokens
            </h4>
            <div className="space-y-2 text-sm font-mono text-[--mr-fg-3]">
              <p>--mr-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)</p>
              <p>--mr-ease-out: cubic-bezier(0.16, 1, 0.3, 1)</p>
              <p>--mr-ease-snappy: cubic-bezier(0.4, 0, 0.2, 1)</p>
              <p>--mr-ease-in-exit: cubic-bezier(0.4, 0, 1, 1)</p>
              <p>--mr-ease-ios: cubic-bezier(0.25, 0.46, 0.45, 0.94)</p>
            </div>
          </div>
        </section>

        {/* Notification */}
        {notification && (
          <div
            className="fixed bottom-6 right-6 px-4 py-3 rounded bg-[--mr-gold-500] text-[--mr-ink-900] text-sm font-label"
            style={{
              animation: `fadeInUp 300ms var(--mr-ease-out) forwards`,
            }}
          >
            {notification}
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
