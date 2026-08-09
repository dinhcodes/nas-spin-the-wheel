import type { Metadata } from 'next'
import { EB_Garamond, Lato } from 'next/font/google'
import './globals.css'

const ebGaramond = EB_Garamond({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
})

const lato = Lato({
  variable: '--font-body',
  weight: ['300', '400', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'NAS wheel',
  description: 'Lucky-draw wheel for the event.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${ebGaramond.variable} ${lato.variable} bg-background`}
    >
      <body className="font-body antialiased">{children}</body>
    </html>
  )
}
