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
- The user needs expected and actual values for income and expenses.
- Initial installation requires opening the web app once; routine use and data storage must work offline afterward.

## Capabilities and Constraints

- Core data: current balance, monthly repayment, monthly rent, salary, receivables, daily expenses, special expenses, and remaining balance.
- Salary and receivables are income categories. Repayment, rent, daily expenses, and special expenses are expense categories.
- Expected and actual totals must be derived from the entries and remain arithmetically consistent.
- Data stays in the browser on the user's device. There is no login, analytics, cloud service, paid API, or network data transfer.
- The user can create, edit, and delete entries; browse months; export a complete backup; and restore a backup.
- The interface language is Simplified Chinese.
- Open deployment decision: an iPhone-installable PWA needs an HTTPS address for first installation. Publishing or hosting is outside the current local build until the user approves a destination.

## Brand Commitments

The interface is concise, calm, and centered on “quickly record one item” and “understand this month.” No product name or logo has been committed.

## Evidence on Hand

No existing records, brand assets, screenshots, or third-party claims were supplied. Demo data must be clearly identified and must never be mixed into the user's saved ledger.

## Product Principles

- A new record should take only a few taps.
- The monthly balance must be understandable without opening a report.
- Every stored record belongs to the user and can be exported in full.
- Offline behavior and arithmetic correctness take priority over decorative features.
- The first version stays focused on one currency and one user.

