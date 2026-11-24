# Spam Call Detector and Call Shield

A minor project in two parts:

1. **Spam detection model** (this folder): a TF-IDF + Logistic Regression classifier trained on labeled call transcripts.
2. **Call Shield** ([`ai-call-agent/`](ai-call-agent/README.md)): a working web app that uses the model on real phone calls. An AI assistant answers unknown callers through Twilio, scam calls are blocked, and a complaint is emailed to the nearest police station, found with OpenStreetMap.

Setup and usage: **[ai-call-agent/README.md](ai-call-agent/README.md)**

## Repository layout

```
.
├── ai-call-agent/
│   ├── backend/          FastAPI API, Twilio webhooks, detection, police reports
│   ├── frontend/         Next.js web app
│   └── spam-detector/    Model files used by the backend (read-only)
├── main.py               Trains the model and writes the .pkl files
├── predict.py            Quick prediction check
├── api.py                Original standalone model API
├── real_calls.csv        Labeled call transcripts (training data)
├── spam_numbers.csv      Known spam numbers
├── spam_model.pkl        Trained Logistic Regression model
└── tfidf_vectorizer.pkl  Trained TF-IDF vectorizer
```

## The model

- **Data:** `real_calls.csv`, about 1,200 call transcripts labeled normal (0) or scam (1).
- **Features:** TF-IDF word weights.
- **Classifier:** scikit-learn `LogisticRegression`.
- **Output:** the probability that a conversation is a scam.

To retrain it:

```bash
pip install pandas scikit-learn joblib
python main.py
```

This writes `spam_model.pkl` and `tfidf_vectorizer.pkl`. Copy them into `ai-call-agent/spam-detector/` to use the new model in Call Shield.

In Call Shield, the model's score is combined with scam phrase rules (English, Hinglish and Hindi) and the caller number's report history. The details are in [ai-call-agent/README.md](ai-call-agent/README.md#detection).
