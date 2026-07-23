import { onRequest } from "firebase-functions/v2/https";
import admin from "./adminInit.js"; // też korzysta z tego samego admina

const storage = admin.storage().bucket();

export const uploadCards = onRequest(async (req, res) => {
  const lang = req.query.lang;

  if (!lang) {
    return res.status(400).send("Błąd: wymagany jest parametr 'lang'.");
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
});