# Demo data

`example-household-2026.json` is entirely fictional - generated for screenshots and for showing the app
to someone without handing over real finances.

A two-income household for 2026:

- 2 earners (68,000 and 41,000 gross), one with a March bonus
- 23 bills and 3 savings commitments, across weekly, monthly, quarterly and annual frequencies
- A disposable-income tracker: 8 subscriptions (streaming, a gym, an AI plan...) and 20 meals out, takeaways and
  other treats logged across August to October, shared between the two of them
- 401 bank transactions from January to 20 August, 45 distinct merchants, with 38 category rules
  that apply themselves on load
- A mortgage: 295,000 drawn down in September 2023 over 30 years, fixed at 4.05% until December
  2026 and then on a 3.85% variable rate, with a 100 a month overpayment, one lump sum, and three
  year-end statements whose balances pull the modelling back into line (about 20 a year of drift)
- 3 loans, including one with lump-sum overpayments modelled
- 4 savings accounts projected over 36 months
- 5 bank accounts and 4 payees, with valid test IBANs
- A full year of half-hourly electricity usage, summarised, and 4 tariffs to compare
- 32 months of historical electricity, gas, broadband and health insurance costs

Load it from **Backup & settings** (Restore from a backup), or press **Show me an example household** on
the welcome screen, which loads the same data without a file. It lands as year 2026, so use a private
window if you already have your own 2026 data in that browser.

The transactions ship uncategorised on purpose - the rules run on load, which is also a decent
demonstration that the categoriser works.
