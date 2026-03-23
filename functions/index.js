// functions/index.js
import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import ejs from "ejs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("ejs", ejs.renderFile);

app.use(express.static(path.join(__dirname, "../public")));

const pageConfig = {
  mainCss: "/css/style.css",
  cardCss: "/css/card.css",
  defaultDescription:
    "Free flashcard app to learn vocabulary in 8 languages with audio pronunciation.",
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: [
      "http://localhost:5000",
      "https://mellowcards.com",
      "https://zentalist.app",
      "https://us-central1-costam-3f612.cloudfunctions.net",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' https://*.googleapis.com https://*.gstatic.com; " +
      "script-src 'self' https://apis.google.com https://cdnjs.cloudflare.com https://www.gstatic.com https://www.googletagmanager.com 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://use.typekit.net 'unsafe-inline'; " +
      "img-src 'self' data: https://www.googletagmanager.com https://storage.googleapis.com https://api.dicebear.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "connect-src 'self' https://zentalist.app https://costam-3f612.web.app https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://us-central1-costam-3f612.cloudfunctions.net https://firestore.googleapis.com https://storage.googleapis.com https://firebasestorage.googleapis.com https://www.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com;"
  );
  next();
});

const pages = [
  {
    path: "/",
    template: "index",
    title: "Zentalist | Learn Vocabulary with Free Flashcards",
    description:
      "Free flashcard app to learn vocabulary in 8 languages. Spanish, German, French, Japanese with audio. Track progress & compete on global leaderboard.",
    customData: { isHome: true },
  },
  {
    path: "/home",
    template: "app",
    title: "Zentalist | Your Learning Home",
    description:
      "Jump back into your learning routine, track daily progress and launch your next flashcard session.",
    customData: { isApp: true, isAppHome: true },
  },
  {
    path: "/learn",
    template: "app",
    title: "Zentalist | Start Learning - Free Vocabulary Flashcards",
    description:
      "Learn Spanish, German, French, Japanese, Korean, Chinese, Russian & Italian vocabulary. Free flashcards with audio pronunciation and progress tracking.",
    customData: { isApp: true, isAppHome: false },
  },
  {
    path: "/premium",
    template: "premium",
    title: "Zentalist Premium | Unlock All Languages & Categories",
    description:
      "Premium upgrades are moving to in-app purchases for iOS and Android.",
    customData: { isPremium: true },
  },
  {
    path: "/profile",
    template: "profile",
    title: "Zentalist | Your Profile",
    description:
      "Manage your Zentalist account, subscription and learning preferences.",
    customData: { isPremium: true },
  },
  {
    path: "/stats",
    template: "stats",
    title: "Zentalist | Your Learning Statistics & Progress",
    description:
      "Track your vocabulary learning progress. View completed categories, study streaks, and mastered words across all 8 languages.",
    customData: { isStats: true },
  },
  {
    path: "/leaderboard",
    template: "leaderboard",
    title: "Zentalist | Global Leaderboard - Top Vocabulary Learners",
    description:
      "See how you rank against vocabulary learners worldwide. Compete for top spots and track your global learning progress.",
    customData: { isLeaderboard: true },
  },
  {
    path: "/challenge",
    template: "challenge",
    title: "Zentalist | Vocabulary Challenge - Test Your Knowledge",
    description:
      "Test your vocabulary knowledge with timed challenges. Score 90%+ to complete categories and earn leaderboard points.",
    customData: { isChallenge: true },
  },
  {
    path: "/legals",
    template: "legals",
    title: "Zentalist | Privacy Policy, Terms of Service & Cookies",
    description:
      "Read Zentalist's Privacy Policy, Terms of Service and Cookie Policy. Learn how we protect your data and what terms apply.",
    customData: { isLegals: true },
  },
];

pages.forEach((page) => {
  app.get(page.path, (req, res) => {
    res.render(page.template, {
      ...pageConfig,
      title: page.title,
      description:
        page.description || `${page.title} - ${pageConfig.defaultDescription}`,
      isHome: page.isHome || false,
      ...(page.customData || {}),
    });
  });
});

app.use((req, res) => {
  res.status(404).render("404", {
    title: "Nie znaleziono strony",
    description: "Strona, ktorej szukasz nie istnieje",
    mainCss: "/css/style.css",
    cardCss: "/css/card.css",
    currentUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
  });
});

export const ssr = onRequest(
  {
    cors: true,
  },
  app
);
