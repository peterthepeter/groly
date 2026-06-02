-- Optionale Verknüpfung einer Mahlzeit-Vorlage zu einem Koffein-Getränk.
-- Beim Loggen der Vorlage wird zusätzlich ein Koffein-Log erzeugt (Nutrition → Koffein).
ALTER TABLE `nutrition_meal_favorites` ADD COLUMN `caffeine_drink_id` text;
