# Geobioguessr
## Product Requirements & Technical Specification

### Version
v1.0

### Project Overview

Geobioguessr is a browser-based geography and history guessing game where players must identify a historical figure using progressively revealed biographical and cartographic clues.

The core gameplay mechanic revolves around displaying the birth and death locations of a historical figure on a 2D world map. Players use geographic reasoning, historical knowledge, and deductive thinking to determine the identity of the person.

Each incorrect guess unlocks an additional clue, up to a maximum of six clues. The game ends when the player correctly identifies the historical figure or exhausts all attempts.

---

# Core Gameplay Loop

## Objective

Identify the historical person before all six clues are revealed.

---

## Game Flow

### 1. Game Initialization

When a new game starts:

- A historical figure is randomly selected from the database.
- The search bar is displayed.
- A 2D world map is rendered.
- Birth location marker is displayed.
- Death location marker is displayed.
- No other clues are initially visible.

Player is immediately able to begin guessing.

---

### 2. Guess Submission

Player enters a name into the search bar.

Example:

```
Albert Einstein
```

The system:

1. Normalizes the input.
2. Searches for matching historical figures.
3. Compares against the selected answer.
4. Returns either:
   - Correct
   - Incorrect

---

### 3. Incorrect Guess

For each incorrect guess:

- Attempt counter increments.
- A new clue is revealed.
- Player may submit another guess.

Maximum attempts:

```
6
```

---

### 4. Correct Guess

If the guess matches the selected historical figure:

- Game ends immediately.
- Success screen shown.
- Statistics displayed.
- Option to start new game.

---

### 5. Failure Condition

If all six attempts are used:

- Correct historical figure revealed.
- Full biography summary displayed.
- Statistics displayed.
- New Game button shown.

---

# Clue Progression System

## Base Information (Always Visible)

### Geographic Clue

The following are shown immediately:

- Birth coordinates
- Death coordinates

Displayed on world map using markers.

Example:

```
Birth: Warsaw, Poland
Death: Paris, France
```

Only coordinates/markers are initially visible.

---

## Hint 1

### Lifespan Information

Reveal:

- Date of Birth
- Date of Death
- Age at Death

Example:

```
Born:
7 November 1867

Died:
4 July 1934

Age:
66
```

---

## Hint 2

### Identity Information

Reveal:

- Ethnicity
- Nationality
- Gender

Example:

```
Ethnicity:
Ashkenazi Jewish

Nationality:
Polish-French

Gender:
Female
```

---

## Hint 3

### Occupation Information

Reveal:

- Industry
- Occupation(s)

Example:

```
Industry:
Science

Occupation:
Physicist
Chemist
Professor
```

---

## Hint 4

### Historical Significance

Reveal:

- Most notable contribution
- Major event associated with

Example:

```
Pioneered research into radioactivity.
```

---

## Hint 5

### Unique Characteristic

Reveal:

A highly distinctive fact.

Examples:

```
First woman to win a Nobel Prize.
```

```
Led the Mongol Empire.
```

```
Painted the Mona Lisa.
```

---

## Hint 6

### Visual Identification

Reveal:

Primary option:

- Portrait image

Fallback:

If no image exists:

```
Initials:
M.C.
```

---

# Search System

## Requirements

The search bar should support:

### Exact Match

```
Isaac Newton
```

### Partial Match

```
Newton
```

### Fuzzy Matching

```
Issac Newten
```

Should still suggest:

```
Isaac Newton
```

---

## Search Result Source

Historical figures should be derived from:

- Wikipedia
- Wikidata

Filtered by:

```
Must be deceased
```

Excluded:

- Living people
- Fictional characters
- Mythological figures

---

# Historical Figure Requirements

Each figure should contain:

```typescript
interface HistoricalFigure {
  id: string;

  name: string;

  aliases: string[];

  birthDate: Date;
  deathDate: Date;

  birthPlace: string;
  deathPlace: string;

  birthLatitude: number;
  birthLongitude: number;

  deathLatitude: number;
  deathLongitude: number;

  ethnicity?: string;
  nationality?: string;
  gender?: string;

  occupation: string[];

  industry: string[];

  notableContribution: string;

  notableFact: string;

  imageUrl?: string;

  wikipediaUrl: string;

  wikidataId: string;
}
```

---

# Difficulty Design

## Easy

Examples:

- Albert Einstein
- Napoleon Bonaparte
- Leonardo da Vinci
- Marie Curie

---

## Medium

Examples:

- Tycho Brahe
- Niels Bohr
- Ada Lovelace
- Ibn Sina

---

## Hard

Examples:

- Al-Khwarizmi
- Jan van Riebeeck
- Hildegard of Bingen
- Ibn Khaldun

---

# Scoring System

## Base Score

Start:

```
1000 points
```

Penalty per wrong guess:

```
-150 points
```

Bonus for first guess:

```
+500 points
```

Minimum score:

```
0
```

---

## Example

Correct on third attempt:

```
1000
-150
-150

Final:
700
```

---

# Statistics Screen

Display:

- Name
- Portrait
- Birth/Death locations
- Lifespan
- Occupation
- Nationality
- Total attempts
- Final score

---

# Daily Challenge Mode

## Daily Puzzle

Every player receives:

- Same historical figure
- Same clues
- Changes every 24 hours UTC

Benefits:

- Social sharing
- Leaderboards
- Daily engagement

---

# Multiplayer Expansion (Future)

## Guess Race

Multiple players compete simultaneously.

Winner:

```
Fastest correct answer.
```

---

## Private Rooms

Create room code.

Friends join.

Shared puzzle.

---

# Technical Architecture

## Frontend

### Language

TypeScript

### Framework

Vite + React

### State Management

Zustand

### Routing

React Router

### Styling

TailwindCSS

### UI Components

shadcn/ui

### Data Fetching

TanStack Query

### Map Rendering

MapLibre GL JS

Projection:

```
Mercator
```

Map Source:

- OpenStreetMap
- OpenFreeMap

Hosting:

- GitHub Pages

DNS:

- Cloudflare

---

# Backend

## Language

TypeScript

## Runtime

Node.js

## Framework

Express.js

Architecture:

```
REST API
```

---

## Authentication

Optional v2

Anonymous play initially.

Future:

- Google OAuth
- GitHub OAuth

---

## Caching

Redis

Use Cases:

- Search suggestions
- Daily puzzle
- Frequently requested figures

---

## Database

MongoDB

Collections:

### Historical Figures

```typescript
historical_figures
```

### Daily Challenges

```typescript
daily_challenges
```

### Leaderboards

```typescript
leaderboards
```

### Analytics

```typescript
analytics
```

---

## ORM

Prisma (Optional)

Benefits:

- Query normalization
- Schema management
- Type safety

---

# API Design

## Get Random Figure

```http
GET /api/game/random
```

Returns:

```json
{
  "gameId": "...",
  "birthCoordinates": [],
  "deathCoordinates": []
}
```

---

## Submit Guess

```http
POST /api/game/guess
```

Request:

```json
{
  "gameId": "...",
  "guess": "Albert Einstein"
}
```

Response:

```json
{
  "correct": false,
  "attempt": 2,
  "newHint": {}
}
```

---

## Search Historical Figures

```http
GET /api/search?q=ein
```

Response:

```json
[
  {
    "id": "...",
    "name": "Albert Einstein"
  }
]
```

---

# External Data Sources

## Primary

Wikidata

Reason:

- Structured
- Machine-readable
- Consistent IDs

---

## Secondary

Wikipedia

Used for:

- Images
- Summaries
- Verification

---

## Geographic Data

OpenStreetMap

Used for:

- Coordinate resolution
- Place validation

---

# Non-Functional Requirements

## Performance

Search response:

```
< 200ms
```

Game load:

```
< 2 seconds
```

---

## Scalability

Target:

```
10,000 DAU
```

without infrastructure changes.

---

## Availability

Target uptime:

```
99.9%
```

---

# Success Metrics

## Engagement

- Average session duration
- Games played per user
- Daily challenge participation

## Retention

- Day 1 retention
- Day 7 retention
- Day 30 retention

## Accuracy

- Average attempts per solve
- Most commonly missed figures
- Hint reveal distribution

---

# MVP Scope

Included:

✅ Random historical figure

✅ World map visualization

✅ Birth/death location clues

✅ Progressive hint system

✅ Search suggestions

✅ Wikipedia/Wikidata integration

✅ Daily challenge

✅ Score calculation

✅ Responsive web UI

Not Included:

❌ Multiplayer

❌ User accounts

❌ Achievements

❌ Mobile application

❌ AI-generated hints

❌ Paid features

---

# Vision

Geobiograph.io combines geography, history, and deduction into a single educational game. Players learn about influential figures through spatial reasoning and progressively revealed biographical clues, creating a unique experience somewhere between GeoGuessr, Wordle, and historical trivia.