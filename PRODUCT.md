# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated implementation choice: a dependency-free HTML/CSS/JavaScript progressive web app, chosen to keep the personal ledger small, portable, and usable offline on an iPhone after installation.

## Users

One private user who records and reviews personal finances primarily on an iPhone 14.

## Product Purpose

Provide a fast monthly view of expected and actual money movement, preserve the user's records locally, and make the data easy to back up and restore without an account or cloud database.

## Positioning

The product is a private monthly money sheet: current balance and the seven categories the user actually cares about are visible and editable without account setup, synchronization, advertising, or financial-service integrations.

## Operating Context

- Primary use is quick entry and review on an iPhone 14.
- Records are grouped by month and denominated only in CNY.
- The user needs one monthly expected amount per category, while actual income and expenses remain dated records.
- Initial installation requires opening the web app once; routine use and data storage must work offline afterward.

## Capabilities and Constraints

- Core data: current balance, monthly repayment, monthly rent, salary, receivables, daily expenses, special expenses, and remaining balance.
- Salary and receivables are income categories. Repayment, rent, daily expenses, and special expenses are expense categories.
- Each category has at most one expected amount per month; saving it again updates that monthly plan. Actual records keep their exact dates.
- Expected and actual totals must remain arithmetically consistent, and expected plans must not appear in the daily timeline.
- Expense records can use balance payment or Huabei. Huabei spending stays visible on its purchase date, does not reduce the current balance or count toward that month's actual expense, and is added automatically to the following month's expected repayment.
- Data stays in the browser on the user's device. There is no login, analytics, cloud service, paid API, or network data transfer.
- The user can create, edit, and delete entries; browse months; export a complete backup; and restore a backup.
- The interface language is Simplified Chinese.
- The installable PWA is published on GitHub Pages at `https://z2670809302-source.github.io/yueyu-ledger/`; program updates keep the same origin so device-local records remain available.

## Brand Commitments

The interface is concise, calm, and centered on “quickly record one item” and “understand this month.” The product name is “月余”, with a paper-ledger app icon.

## Evidence on Hand

No existing records, brand assets, screenshots, or third-party claims were supplied. Demo data must be clearly identified and must never be mixed into the user's saved ledger.

## Product Principles

- A new record should take only a few taps.
- Form controls must not trigger Safari page zoom on the primary iPhone 14 viewport.
- The monthly balance must be understandable without opening a report.
- Every stored record belongs to the user and can be exported in full.
- Offline behavior and arithmetic correctness take priority over decorative features.
- The first version stays focused on one currency and one user.
