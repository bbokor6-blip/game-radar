import "./globals.css";

export const metadata = {
  title: "Game Radar | BetRadar + GameRadar",
  description: "Football intelligence for the bets worth your attention and the live games you cannot miss.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
