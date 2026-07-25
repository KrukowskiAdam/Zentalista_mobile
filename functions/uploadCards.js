import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import admin from "./adminInit.js"; // też korzysta z tego samego admina

const storage = admin.storage().bucket();

const uploadCardsSecret = defineSecret("UPLOAD_CARDS_SECRET");
const SUPPORTED_LANGS = ["es", "de", "fr", "ru", "zh", "ja", "ko", "it"];

export const uploadCards = onRequest(
  { secrets: [uploadCardsSecret] },
  async (req, res) => {
    if (req.get("x-upload-secret") !== uploadCardsSecret.value()) {
      return res.status(403).send("Błąd: brak autoryzacji.");
    }

    const lang = req.query.lang;

    if (!lang || !SUPPORTED_LANGS.includes(lang)) {
      return res
        .status(400)
        .send(
          `Błąd: parametr 'lang' musi być jednym z: ${SUPPORTED_LANGS.join(", ")}.`
        );
    }

    try {
      const fileName = `cards/cards${lang}.json`;
      const [contents] = await storage.file(fileName).download();
      const cardsData = JSON.parse(contents.toString("utf8"));

      const db = admin.firestore();
      const collectionName = `cards${lang}`;
      const cardsRef = db.collection(collectionName);

      for (const card of cardsData) {
        await cardsRef.add(card);
      }

      res.status(200).send(`Upload JSON dla języka ${lang} zakończony pomyślnie!`);
    } catch (error) {
      console.error("Błąd przy uploadowaniu JSON:", error);
      res.status(500).send("Błąd przy uploadowaniu JSON: " + error.message);
    }
  }
);
