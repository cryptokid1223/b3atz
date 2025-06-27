import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Music Visualizer',
  description: 'Real-time music visualization with p5.js and Tone.js',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.8.0/p5.min.js"></script>
        <script src="https://unpkg.com/tone@14.7.77/build/Tone.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/CCapture.js/1.1.0/CCapture.all.min.js"></script>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
} 