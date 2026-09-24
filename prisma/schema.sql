-- Очистка старых/неполных таблиц перед созданием
DROP TABLE IF EXISTS "MapElement" CASCADE;
DROP TABLE IF EXISTS "Combatant" CASCADE;
DROP TABLE IF EXISTS "Combat" CASCADE;
DROP TABLE IF EXISTS "Summary" CASCADE;
DROP TABLE IF EXISTS "ChatMessage" CASCADE;
DROP TABLE IF EXISTS "Memory" CASCADE;
DROP TABLE IF EXISTS "GameEvent" CASCADE;
DROP TABLE IF EXISTS "Character" CASCADE;
DROP TABLE IF EXISTS "AttackLibrary" CASCADE;
DROP TABLE IF EXISTS "SpellLibrary" CASCADE;
DROP TABLE IF EXISTS "AbilityLibrary" CASCADE;
DROP TABLE IF EXISTS "Campaign" CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "setting" TEXT NOT NULL DEFAULT 'Forgotten Realms',
    "tone" TEXT NOT NULL DEFAULT 'heroic',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'normal',
    "language" TEXT NOT NULL DEFAULT 'ru',
    "dmStyle" TEXT NOT NULL DEFAULT 'balanced',
    "ruleStrictness" TEXT NOT NULL DEFAULT 'standard',
    "startingLevel" INTEGER NOT NULL DEFAULT 1,
    "worldDescription" TEXT,
    "customDmNotes" TEXT,
    "pvpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "restFrequency" TEXT NOT NULL DEFAULT 'standard',
    "partyTies" TEXT NOT NULL DEFAULT 'tight_knit',
    "levelFrom" INTEGER NOT NULL DEFAULT 1,
    "levelTo" INTEGER NOT NULL DEFAULT 5,
    "storyArc" TEXT,
    "arcStatus" TEXT NOT NULL DEFAULT 'none',
    "arcProgress" TEXT,
    "arcModel" TEXT,
    "arcCurrentAct" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'npc',
    "race" TEXT,
    "class" TEXT,
    "subclass" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experiencePoints" INTEGER NOT NULL DEFAULT 0,
    "background" TEXT,
    "str" INTEGER NOT NULL DEFAULT 10,
    "dex" INTEGER NOT NULL DEFAULT 10,
    "con" INTEGER NOT NULL DEFAULT 10,
    "int" INTEGER NOT NULL DEFAULT 10,
    "wis" INTEGER NOT NULL DEFAULT 10,
    "cha" INTEGER NOT NULL DEFAULT 10,
    "hpCurrent" INTEGER NOT NULL DEFAULT 10,
    "hpMax" INTEGER NOT NULL DEFAULT 10,
    "hpTemp" INTEGER NOT NULL DEFAULT 0,
    "ac" INTEGER NOT NULL DEFAULT 10,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "profBonus" INTEGER NOT NULL DEFAULT 2,
    "inventory" TEXT,
    "spells" TEXT,
    "appearance" TEXT,
    "personality" TEXT,
    "bonds" TEXT,
    "flaws" TEXT,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "inScene" BOOLEAN NOT NULL DEFAULT true,
    "relation" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "participants" TEXT,
    "result" TEXT,
    "turn" INTEGER NOT NULL DEFAULT 0,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" TEXT,
    "toolResults" TEXT,
    "turn" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fromTurn" INTEGER NOT NULL,
    "toTurn" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Combat" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Бой',
    "status" TEXT NOT NULL DEFAULT 'active',
    "round" INTEGER NOT NULL DEFAULT 1,
    "currentTurnIndex" INTEGER NOT NULL DEFAULT 0,
    "turnOrder" TEXT NOT NULL DEFAULT '[]',
    "gridWidth" INTEGER NOT NULL DEFAULT 20,
    "gridHeight" INTEGER NOT NULL DEFAULT 15,
    "cellSize" INTEGER NOT NULL DEFAULT 40,
    "backgroundUrl" TEXT,
    "log" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Combat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Combatant" (
    "id" TEXT NOT NULL,
    "combatId" TEXT NOT NULL,
    "characterId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "hpCurrent" INTEGER NOT NULL DEFAULT 10,
    "hpMax" INTEGER NOT NULL DEFAULT 10,
    "hpTemp" INTEGER NOT NULL DEFAULT 0,
    "ac" INTEGER NOT NULL DEFAULT 10,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "initiative" INTEGER NOT NULL DEFAULT 0,
    "initiativeTiebreak" INTEGER NOT NULL DEFAULT 0,
    "dexMod" INTEGER NOT NULL DEFAULT 0,
    "conditions" TEXT NOT NULL DEFAULT '[]',
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hasActed" BOOLEAN NOT NULL DEFAULT false,
    "className" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "size" TEXT NOT NULL DEFAULT 'medium',
    "movementUsed" INTEGER NOT NULL DEFAULT 0,
    "actionUsed" BOOLEAN NOT NULL DEFAULT false,
    "bonusActionUsed" BOOLEAN NOT NULL DEFAULT false,
    "reactionUsed" BOOLEAN NOT NULL DEFAULT false,
    "attacksPerAction" INTEGER NOT NULL DEFAULT 1,
    "attacksMadeThisAction" INTEGER NOT NULL DEFAULT 0,
    "extraActions" INTEGER NOT NULL DEFAULT 0,
    "hotbar" TEXT NOT NULL DEFAULT '[]',
    "attacks" TEXT NOT NULL DEFAULT '[]',
    "spells" TEXT NOT NULL DEFAULT '{}',
    "abilities" TEXT NOT NULL DEFAULT '[]',
    "concentration" TEXT,
    "wildShape" TEXT,
    "facing" TEXT NOT NULL DEFAULT 'E',
    "saves" TEXT NOT NULL DEFAULT '{}',
    "abilityMods" TEXT NOT NULL DEFAULT '{}',
    "profBonus" INTEGER NOT NULL DEFAULT 2,
    "isAIControlled" BOOLEAN NOT NULL DEFAULT false,
    "potions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Combatant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapElement" (
    "id" TEXT NOT NULL,
    "combatId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,
    "properties" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackLibrary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'melee',
    "attackBonus" INTEGER NOT NULL DEFAULT 0,
    "damage" TEXT NOT NULL DEFAULT '[]',
    "rangeNormal" INTEGER NOT NULL DEFAULT 5,
    "rangeLong" INTEGER,
    "finesse" BOOLEAN NOT NULL DEFAULT false,
    "actionCost" TEXT NOT NULL DEFAULT 'action',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttackLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpellLibrary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "school" TEXT,
    "parameters" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpellLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbilityLibrary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT,
    "className" TEXT NOT NULL DEFAULT '',
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'utility',
    "parameters" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbilityLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_userId_idx" ON "Campaign"("userId");

-- CreateIndex
CREATE INDEX "Character_campaignId_idx" ON "Character"("campaignId");

-- CreateIndex
CREATE INDEX "Character_type_idx" ON "Character"("type");

-- CreateIndex
CREATE INDEX "GameEvent_campaignId_idx" ON "GameEvent"("campaignId");

-- CreateIndex
CREATE INDEX "GameEvent_turn_idx" ON "GameEvent"("turn");

-- CreateIndex
CREATE INDEX "Memory_campaignId_category_idx" ON "Memory"("campaignId", "category");

-- CreateIndex
CREATE INDEX "Memory_campaignId_importance_idx" ON "Memory"("campaignId", "importance");

-- CreateIndex
CREATE INDEX "ChatMessage_campaignId_turn_idx" ON "ChatMessage"("campaignId", "turn");

-- CreateIndex
CREATE INDEX "Summary_campaignId_idx" ON "Summary"("campaignId");

-- CreateIndex
CREATE INDEX "Combat_campaignId_idx" ON "Combat"("campaignId");

-- CreateIndex
CREATE INDEX "Combatant_combatId_idx" ON "Combatant"("combatId");

-- CreateIndex
CREATE INDEX "MapElement_combatId_idx" ON "MapElement"("combatId");

-- CreateIndex
CREATE UNIQUE INDEX "AttackLibrary_name_key" ON "AttackLibrary"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SpellLibrary_name_key" ON "SpellLibrary"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AbilityLibrary_name_key" ON "AbilityLibrary"("name");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combat" ADD CONSTRAINT "Combat_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combatant" ADD CONSTRAINT "Combatant_combatId_fkey" FOREIGN KEY ("combatId") REFERENCES "Combat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapElement" ADD CONSTRAINT "MapElement_combatId_fkey" FOREIGN KEY ("combatId") REFERENCES "Combat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
