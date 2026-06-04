// Kuratierte Grundlebensmittel-Datenbank für den Ernährungstracker.
// Werte pro 100g (bzw. 100ml für Flüssigkeiten), Quellen: USDA FoodData Central, BLS.
// Bei Mehrdeutigkeit (z.B. "Kartoffel roh vs. gekocht") wird die Standardform genommen,
// gegart-Varianten als eigene Einträge mit Suffix.

export type GenericFoodSeed = {
	id: string;
	category: string;
	nameDe: string;
	nameEn: string;
	keywordsDe?: string;
	keywordsEn?: string;
	kcalPer100: number;
	proteinPer100?: number;
	fatPer100?: number;
	carbsPer100?: number;
	sugarPer100?: number;
	fiberPer100?: number;
	saltPer100?: number;
	defaultPieceWeight?: number;
	defaultUnit?: 'g' | 'ml' | 'piece';
};

export const GENERIC_FOODS: GenericFoodSeed[] = [
	// ============== OBST ==============
	{ id: 'apple-raw', category: 'fruit', nameDe: 'Apfel', nameEn: 'Apple', keywordsDe: 'apfel,obst', keywordsEn: 'apple,fruit', kcalPer100: 52, proteinPer100: 0.3, fatPer100: 0.2, carbsPer100: 14, sugarPer100: 10.4, fiberPer100: 2.4, saltPer100: 0, defaultPieceWeight: 180 },
	{ id: 'banana-raw', category: 'fruit', nameDe: 'Banane', nameEn: 'Banana', keywordsDe: 'banane,obst', keywordsEn: 'banana', kcalPer100: 89, proteinPer100: 1.1, fatPer100: 0.3, carbsPer100: 23, sugarPer100: 12, fiberPer100: 2.6, saltPer100: 0, defaultPieceWeight: 120 },
	{ id: 'pear-raw', category: 'fruit', nameDe: 'Birne', nameEn: 'Pear', kcalPer100: 57, proteinPer100: 0.4, fatPer100: 0.1, carbsPer100: 15, sugarPer100: 9.8, fiberPer100: 3.1, saltPer100: 0, defaultPieceWeight: 180 },
	{ id: 'orange-raw', category: 'fruit', nameDe: 'Orange', nameEn: 'Orange', kcalPer100: 47, proteinPer100: 0.9, fatPer100: 0.1, carbsPer100: 12, sugarPer100: 9.4, fiberPer100: 2.4, saltPer100: 0, defaultPieceWeight: 130 },
	{ id: 'mandarine-raw', category: 'fruit', nameDe: 'Mandarine', nameEn: 'Mandarin', keywordsDe: 'clementine', keywordsEn: 'clementine,tangerine', kcalPer100: 53, proteinPer100: 0.8, fatPer100: 0.3, carbsPer100: 13, sugarPer100: 11, fiberPer100: 1.8, saltPer100: 0, defaultPieceWeight: 70 },
	{ id: 'grapes-raw', category: 'fruit', nameDe: 'Weintrauben', nameEn: 'Grapes', keywordsDe: 'trauben', keywordsEn: 'grape', kcalPer100: 69, proteinPer100: 0.7, fatPer100: 0.2, carbsPer100: 18, sugarPer100: 16, fiberPer100: 0.9, saltPer100: 0 },
	{ id: 'strawberry-raw', category: 'fruit', nameDe: 'Erdbeere', nameEn: 'Strawberry', keywordsDe: 'erdbeeren,beeren', keywordsEn: 'strawberries,berry', kcalPer100: 32, proteinPer100: 0.7, fatPer100: 0.3, carbsPer100: 7.7, sugarPer100: 4.9, fiberPer100: 2, saltPer100: 0 },
	{ id: 'blueberry-raw', category: 'fruit', nameDe: 'Heidelbeere', nameEn: 'Blueberry', keywordsDe: 'heidelbeeren,blaubeere,blaubeeren', keywordsEn: 'blueberries', kcalPer100: 57, proteinPer100: 0.7, fatPer100: 0.3, carbsPer100: 14, sugarPer100: 10, fiberPer100: 2.4, saltPer100: 0 },
	{ id: 'raspberry-raw', category: 'fruit', nameDe: 'Himbeere', nameEn: 'Raspberry', keywordsDe: 'himbeeren', keywordsEn: 'raspberries', kcalPer100: 52, proteinPer100: 1.2, fatPer100: 0.7, carbsPer100: 12, sugarPer100: 4.4, fiberPer100: 6.5, saltPer100: 0 },
	{ id: 'kiwi-raw', category: 'fruit', nameDe: 'Kiwi', nameEn: 'Kiwi', kcalPer100: 61, proteinPer100: 1.1, fatPer100: 0.5, carbsPer100: 15, sugarPer100: 9, fiberPer100: 3, saltPer100: 0, defaultPieceWeight: 75 },
	{ id: 'peach-raw', category: 'fruit', nameDe: 'Pfirsich', nameEn: 'Peach', kcalPer100: 39, proteinPer100: 0.9, fatPer100: 0.3, carbsPer100: 10, sugarPer100: 8.4, fiberPer100: 1.5, saltPer100: 0, defaultPieceWeight: 150 },
	{ id: 'plum-raw', category: 'fruit', nameDe: 'Pflaume', nameEn: 'Plum', keywordsDe: 'pflaumen,zwetschge', keywordsEn: 'plums', kcalPer100: 46, proteinPer100: 0.7, fatPer100: 0.3, carbsPer100: 11, sugarPer100: 9.9, fiberPer100: 1.4, saltPer100: 0, defaultPieceWeight: 65 },
	{ id: 'cherry-raw', category: 'fruit', nameDe: 'Kirsche', nameEn: 'Cherry', keywordsDe: 'kirschen', keywordsEn: 'cherries', kcalPer100: 63, proteinPer100: 1.1, fatPer100: 0.2, carbsPer100: 16, sugarPer100: 13, fiberPer100: 2.1, saltPer100: 0 },
	{ id: 'pineapple-raw', category: 'fruit', nameDe: 'Ananas', nameEn: 'Pineapple', kcalPer100: 50, proteinPer100: 0.5, fatPer100: 0.1, carbsPer100: 13, sugarPer100: 9.9, fiberPer100: 1.4, saltPer100: 0 },
	{ id: 'watermelon-raw', category: 'fruit', nameDe: 'Wassermelone', nameEn: 'Watermelon', kcalPer100: 30, proteinPer100: 0.6, fatPer100: 0.2, carbsPer100: 8, sugarPer100: 6.2, fiberPer100: 0.4, saltPer100: 0 },
	{ id: 'melon-raw', category: 'fruit', nameDe: 'Honigmelone', nameEn: 'Honeydew melon', keywordsDe: 'melone', keywordsEn: 'melon', kcalPer100: 36, proteinPer100: 0.5, fatPer100: 0.1, carbsPer100: 9.1, sugarPer100: 8.1, fiberPer100: 0.8, saltPer100: 0 },
	{ id: 'mango-raw', category: 'fruit', nameDe: 'Mango', nameEn: 'Mango', kcalPer100: 60, proteinPer100: 0.8, fatPer100: 0.4, carbsPer100: 15, sugarPer100: 14, fiberPer100: 1.6, saltPer100: 0 },
	{ id: 'avocado-raw', category: 'fruit', nameDe: 'Avocado', nameEn: 'Avocado', kcalPer100: 160, proteinPer100: 2, fatPer100: 15, carbsPer100: 8.5, sugarPer100: 0.7, fiberPer100: 6.7, saltPer100: 0, defaultPieceWeight: 170 },
	{ id: 'lemon-raw', category: 'fruit', nameDe: 'Zitrone', nameEn: 'Lemon', kcalPer100: 29, proteinPer100: 1.1, fatPer100: 0.3, carbsPer100: 9, sugarPer100: 2.5, fiberPer100: 2.8, saltPer100: 0, defaultPieceWeight: 60 },
	{ id: 'apricot-raw', category: 'fruit', nameDe: 'Aprikose', nameEn: 'Apricot', keywordsDe: 'marille,aprikosen', keywordsEn: 'apricots', kcalPer100: 48, proteinPer100: 1.4, fatPer100: 0.4, carbsPer100: 11, sugarPer100: 9.2, fiberPer100: 2, saltPer100: 0, defaultPieceWeight: 35 },
	{ id: 'date-dried', category: 'fruit', nameDe: 'Datteln', nameEn: 'Dates', keywordsDe: 'dattel,medjool', keywordsEn: 'date,medjool', kcalPer100: 277, proteinPer100: 1.8, fatPer100: 0.2, carbsPer100: 75, sugarPer100: 66, fiberPer100: 6.7, saltPer100: 0, defaultPieceWeight: 8 },
	{ id: 'raisins', category: 'fruit', nameDe: 'Rosinen', nameEn: 'Raisins', keywordsDe: 'sultaninen', keywordsEn: 'sultanas', kcalPer100: 299, proteinPer100: 3.1, fatPer100: 0.5, carbsPer100: 79, sugarPer100: 59, fiberPer100: 3.7, saltPer100: 0 },

	// ============== GEMÜSE ==============
	{ id: 'potato-raw', category: 'vegetable', nameDe: 'Kartoffel roh', nameEn: 'Potato raw', keywordsDe: 'kartoffeln,erdäpfel', keywordsEn: 'potatoes', kcalPer100: 77, proteinPer100: 2, fatPer100: 0.1, carbsPer100: 17, sugarPer100: 0.8, fiberPer100: 2.2, saltPer100: 0.02, defaultPieceWeight: 150 },
	{ id: 'potato-boiled', category: 'vegetable', nameDe: 'Kartoffel gekocht', nameEn: 'Potato boiled', keywordsDe: 'pellkartoffel,salzkartoffel', keywordsEn: 'boiled potato', kcalPer100: 87, proteinPer100: 1.9, fatPer100: 0.1, carbsPer100: 20, sugarPer100: 0.9, fiberPer100: 1.8, saltPer100: 0.02 },
	{ id: 'sweet-potato-raw', category: 'vegetable', nameDe: 'Süßkartoffel', nameEn: 'Sweet potato', keywordsDe: 'batate', keywordsEn: 'yam', kcalPer100: 86, proteinPer100: 1.6, fatPer100: 0.1, carbsPer100: 20, sugarPer100: 4.2, fiberPer100: 3, saltPer100: 0.02 },
	{ id: 'carrot-raw', category: 'vegetable', nameDe: 'Möhre', nameEn: 'Carrot', keywordsDe: 'karotte,möhren,karotten', keywordsEn: 'carrots', kcalPer100: 41, proteinPer100: 0.9, fatPer100: 0.2, carbsPer100: 10, sugarPer100: 4.7, fiberPer100: 2.8, saltPer100: 0.17, defaultPieceWeight: 80 },
	{ id: 'kohlrabi-raw', category: 'vegetable', nameDe: 'Kohlrabi', nameEn: 'Kohlrabi', keywordsDe: 'kohlrabi', keywordsEn: 'kohlrabi,german turnip', kcalPer100: 27, proteinPer100: 1.7, fatPer100: 0.1, carbsPer100: 6.2, sugarPer100: 2.6, fiberPer100: 3.6, saltPer100: 0.02, defaultPieceWeight: 150 },
	{ id: 'tomato-raw', category: 'vegetable', nameDe: 'Tomate', nameEn: 'Tomato', keywordsDe: 'tomaten', keywordsEn: 'tomatoes', kcalPer100: 18, proteinPer100: 0.9, fatPer100: 0.2, carbsPer100: 3.9, sugarPer100: 2.6, fiberPer100: 1.2, saltPer100: 0.01, defaultPieceWeight: 100 },
	{ id: 'cucumber-raw', category: 'vegetable', nameDe: 'Gurke', nameEn: 'Cucumber', keywordsDe: 'gurken,salatgurke', keywordsEn: 'cucumbers', kcalPer100: 16, proteinPer100: 0.7, fatPer100: 0.1, carbsPer100: 3.6, sugarPer100: 1.7, fiberPer100: 0.5, saltPer100: 0, defaultPieceWeight: 350 },
	{ id: 'paprika-raw', category: 'vegetable', nameDe: 'Paprika', nameEn: 'Bell pepper', keywordsDe: 'paprikaschote', keywordsEn: 'pepper,capsicum', kcalPer100: 31, proteinPer100: 1, fatPer100: 0.3, carbsPer100: 6, sugarPer100: 4.2, fiberPer100: 2.1, saltPer100: 0, defaultPieceWeight: 150 },
	{ id: 'broccoli-raw', category: 'vegetable', nameDe: 'Brokkoli', nameEn: 'Broccoli', keywordsDe: 'broccoli', keywordsEn: 'broccoli', kcalPer100: 34, proteinPer100: 2.8, fatPer100: 0.4, carbsPer100: 6.6, sugarPer100: 1.7, fiberPer100: 2.6, saltPer100: 0.08 },
	{ id: 'cauliflower-raw', category: 'vegetable', nameDe: 'Blumenkohl', nameEn: 'Cauliflower', keywordsDe: 'karfiol', keywordsEn: 'cauli', kcalPer100: 25, proteinPer100: 1.9, fatPer100: 0.3, carbsPer100: 5, sugarPer100: 1.9, fiberPer100: 2, saltPer100: 0.07 },
	{ id: 'spinach-raw', category: 'vegetable', nameDe: 'Spinat', nameEn: 'Spinach', kcalPer100: 23, proteinPer100: 2.9, fatPer100: 0.4, carbsPer100: 3.6, sugarPer100: 0.4, fiberPer100: 2.2, saltPer100: 0.2 },
	{ id: 'lettuce-raw', category: 'vegetable', nameDe: 'Kopfsalat', nameEn: 'Lettuce', keywordsDe: 'salat,grüner salat', keywordsEn: 'salad', kcalPer100: 15, proteinPer100: 1.4, fatPer100: 0.2, carbsPer100: 2.9, sugarPer100: 0.8, fiberPer100: 1.3, saltPer100: 0.03 },
	{ id: 'rocket-raw', category: 'vegetable', nameDe: 'Rucola', nameEn: 'Arugula', keywordsDe: 'rauke', keywordsEn: 'rocket', kcalPer100: 25, proteinPer100: 2.6, fatPer100: 0.7, carbsPer100: 3.7, sugarPer100: 2, fiberPer100: 1.6, saltPer100: 0.07 },
	{ id: 'onion-raw', category: 'vegetable', nameDe: 'Zwiebel', nameEn: 'Onion', keywordsDe: 'zwiebeln,gemüsezwiebel', keywordsEn: 'onions', kcalPer100: 40, proteinPer100: 1.1, fatPer100: 0.1, carbsPer100: 9.3, sugarPer100: 4.2, fiberPer100: 1.7, saltPer100: 0.01, defaultPieceWeight: 110 },
	{ id: 'garlic-raw', category: 'vegetable', nameDe: 'Knoblauch', nameEn: 'Garlic', kcalPer100: 149, proteinPer100: 6.4, fatPer100: 0.5, carbsPer100: 33, sugarPer100: 1, fiberPer100: 2.1, saltPer100: 0.04, defaultPieceWeight: 3 },
	{ id: 'mushroom-raw', category: 'vegetable', nameDe: 'Champignon', nameEn: 'Mushroom', keywordsDe: 'pilze,champignons', keywordsEn: 'mushrooms,button mushroom', kcalPer100: 22, proteinPer100: 3.1, fatPer100: 0.3, carbsPer100: 3.3, sugarPer100: 1.7, fiberPer100: 1, saltPer100: 0.01 },
	{ id: 'zucchini-raw', category: 'vegetable', nameDe: 'Zucchini', nameEn: 'Zucchini', keywordsDe: 'courgette', keywordsEn: 'courgette', kcalPer100: 17, proteinPer100: 1.2, fatPer100: 0.3, carbsPer100: 3.1, sugarPer100: 2.5, fiberPer100: 1, saltPer100: 0.02 },
	{ id: 'eggplant-raw', category: 'vegetable', nameDe: 'Aubergine', nameEn: 'Eggplant', keywordsDe: 'auberginen', keywordsEn: 'aubergine', kcalPer100: 25, proteinPer100: 1, fatPer100: 0.2, carbsPer100: 5.9, sugarPer100: 3.5, fiberPer100: 3, saltPer100: 0 },
	{ id: 'corn-canned', category: 'vegetable', nameDe: 'Mais Dose', nameEn: 'Corn canned', keywordsDe: 'mais,dosenmais,zuckermais', keywordsEn: 'sweetcorn', kcalPer100: 86, proteinPer100: 2.6, fatPer100: 1.2, carbsPer100: 19, sugarPer100: 6.3, fiberPer100: 2.4, saltPer100: 0.6 },
	{ id: 'peas-raw', category: 'vegetable', nameDe: 'Erbsen', nameEn: 'Peas', keywordsDe: 'erbse,grüne erbsen', keywordsEn: 'green peas', kcalPer100: 81, proteinPer100: 5.4, fatPer100: 0.4, carbsPer100: 14, sugarPer100: 5.7, fiberPer100: 5.1, saltPer100: 0.01 },
	{ id: 'beans-green-raw', category: 'vegetable', nameDe: 'Grüne Bohnen', nameEn: 'Green beans', keywordsDe: 'gartenbohnen,brechbohnen', keywordsEn: 'string beans', kcalPer100: 31, proteinPer100: 1.8, fatPer100: 0.2, carbsPer100: 7, sugarPer100: 3.3, fiberPer100: 2.7, saltPer100: 0.01 },
	{ id: 'cabbage-white-raw', category: 'vegetable', nameDe: 'Weißkohl', nameEn: 'White cabbage', keywordsDe: 'kohl,weißkraut', keywordsEn: 'cabbage', kcalPer100: 25, proteinPer100: 1.3, fatPer100: 0.1, carbsPer100: 5.8, sugarPer100: 3.2, fiberPer100: 2.5, saltPer100: 0.04 },
	{ id: 'sauerkraut', category: 'vegetable', nameDe: 'Sauerkraut', nameEn: 'Sauerkraut', kcalPer100: 19, proteinPer100: 0.9, fatPer100: 0.1, carbsPer100: 4.3, sugarPer100: 1.8, fiberPer100: 2.9, saltPer100: 1.5 },
	{ id: 'olives-green', category: 'vegetable', nameDe: 'Oliven grün', nameEn: 'Green olives', kcalPer100: 145, proteinPer100: 1, fatPer100: 15, carbsPer100: 4, sugarPer100: 0.5, fiberPer100: 3.3, saltPer100: 4.9 },
	{ id: 'pickle', category: 'vegetable', nameDe: 'Essiggurke', nameEn: 'Pickle', keywordsDe: 'gewürzgurke,saure gurke', keywordsEn: 'gherkin', kcalPer100: 11, proteinPer100: 0.3, fatPer100: 0.2, carbsPer100: 2.3, sugarPer100: 1.1, fiberPer100: 1.2, saltPer100: 1.3 },

	// ============== GETREIDE / BEILAGEN ==============
	{ id: 'rice-white-cooked', category: 'grain', nameDe: 'Reis gekocht', nameEn: 'Rice cooked', keywordsDe: 'weißer reis,basmati', keywordsEn: 'white rice,basmati', kcalPer100: 130, proteinPer100: 2.7, fatPer100: 0.3, carbsPer100: 28, sugarPer100: 0.1, fiberPer100: 0.4, saltPer100: 0 },
	{ id: 'rice-brown-cooked', category: 'grain', nameDe: 'Vollkornreis gekocht', nameEn: 'Brown rice cooked', keywordsDe: 'naturreis', keywordsEn: 'brown rice', kcalPer100: 123, proteinPer100: 2.7, fatPer100: 1, carbsPer100: 26, sugarPer100: 0.4, fiberPer100: 1.6, saltPer100: 0 },
	{ id: 'pasta-cooked', category: 'grain', nameDe: 'Nudeln gekocht', nameEn: 'Pasta cooked', keywordsDe: 'spaghetti,penne,fusilli', keywordsEn: 'noodles,spaghetti', kcalPer100: 131, proteinPer100: 5, fatPer100: 1.1, carbsPer100: 25, sugarPer100: 0.6, fiberPer100: 1.8, saltPer100: 0.01 },
	{ id: 'pasta-whole-cooked', category: 'grain', nameDe: 'Vollkornnudeln gekocht', nameEn: 'Whole wheat pasta cooked', kcalPer100: 124, proteinPer100: 5.3, fatPer100: 1.4, carbsPer100: 26, sugarPer100: 0.6, fiberPer100: 3.9, saltPer100: 0.01 },
	{ id: 'oats-raw', category: 'grain', nameDe: 'Haferflocken', nameEn: 'Oats', keywordsDe: 'hafer,porridge', keywordsEn: 'oatmeal,rolled oats', kcalPer100: 379, proteinPer100: 13, fatPer100: 6.5, carbsPer100: 67, sugarPer100: 1, fiberPer100: 10, saltPer100: 0 },
	{ id: 'muesli', category: 'grain', nameDe: 'Müsli', nameEn: 'Muesli', kcalPer100: 363, proteinPer100: 10, fatPer100: 6, carbsPer100: 66, sugarPer100: 16, fiberPer100: 7, saltPer100: 0.1 },
	{ id: 'cornflakes', category: 'grain', nameDe: 'Cornflakes', nameEn: 'Cornflakes', kcalPer100: 357, proteinPer100: 7.5, fatPer100: 0.9, carbsPer100: 84, sugarPer100: 8, fiberPer100: 3, saltPer100: 1.1 },
	{ id: 'couscous-cooked', category: 'grain', nameDe: 'Couscous gekocht', nameEn: 'Couscous cooked', kcalPer100: 112, proteinPer100: 3.8, fatPer100: 0.2, carbsPer100: 23, sugarPer100: 0.1, fiberPer100: 1.4, saltPer100: 0.01 },
	{ id: 'quinoa-cooked', category: 'grain', nameDe: 'Quinoa gekocht', nameEn: 'Quinoa cooked', kcalPer100: 120, proteinPer100: 4.4, fatPer100: 1.9, carbsPer100: 21, sugarPer100: 0.9, fiberPer100: 2.8, saltPer100: 0.01 },
	{ id: 'bulgur-cooked', category: 'grain', nameDe: 'Bulgur gekocht', nameEn: 'Bulgur cooked', kcalPer100: 83, proteinPer100: 3.1, fatPer100: 0.2, carbsPer100: 19, sugarPer100: 0.1, fiberPer100: 4.5, saltPer100: 0.01 },
	{ id: 'flour-wheat', category: 'grain', nameDe: 'Weizenmehl', nameEn: 'Wheat flour', keywordsDe: 'mehl,type 405', keywordsEn: 'flour', kcalPer100: 364, proteinPer100: 10, fatPer100: 1, carbsPer100: 76, sugarPer100: 0.3, fiberPer100: 2.7, saltPer100: 0 },

	// ============== BROT / BACKWAREN ==============
	{ id: 'bread-whole', category: 'bread', nameDe: 'Vollkornbrot', nameEn: 'Whole grain bread', keywordsDe: 'körnerbrot', keywordsEn: 'wholemeal bread', kcalPer100: 247, proteinPer100: 8.8, fatPer100: 3.4, carbsPer100: 41, sugarPer100: 4.6, fiberPer100: 7, saltPer100: 1.3, defaultPieceWeight: 50 },
	{ id: 'bread-white', category: 'bread', nameDe: 'Weißbrot', nameEn: 'White bread', keywordsDe: 'toast,toastbrot', keywordsEn: 'toast', kcalPer100: 265, proteinPer100: 9, fatPer100: 3.2, carbsPer100: 49, sugarPer100: 5, fiberPer100: 2.7, saltPer100: 1.2, defaultPieceWeight: 30 },
	{ id: 'bread-rye', category: 'bread', nameDe: 'Roggenbrot', nameEn: 'Rye bread', keywordsDe: 'pumpernickel', keywordsEn: 'pumpernickel', kcalPer100: 259, proteinPer100: 8.5, fatPer100: 3.3, carbsPer100: 48, sugarPer100: 3.9, fiberPer100: 5.8, saltPer100: 1.4, defaultPieceWeight: 50 },
	{ id: 'bread-roll', category: 'bread', nameDe: 'Brötchen', nameEn: 'Bread roll', keywordsDe: 'semmel,schrippe,weckle', keywordsEn: 'roll,bun', kcalPer100: 278, proteinPer100: 9, fatPer100: 3.5, carbsPer100: 52, sugarPer100: 2.5, fiberPer100: 2.8, saltPer100: 1.3, defaultPieceWeight: 60 },
	{ id: 'bread-pretzel', category: 'bread', nameDe: 'Brezel', nameEn: 'Pretzel', kcalPer100: 322, proteinPer100: 10, fatPer100: 3.6, carbsPer100: 62, sugarPer100: 2, fiberPer100: 2.5, saltPer100: 2.5, defaultPieceWeight: 80 },
	{ id: 'croissant', category: 'bread', nameDe: 'Croissant', nameEn: 'Croissant', keywordsDe: 'hörnchen', keywordsEn: 'crescent', kcalPer100: 406, proteinPer100: 8.2, fatPer100: 21, carbsPer100: 45, sugarPer100: 11, fiberPer100: 2.6, saltPer100: 0.8, defaultPieceWeight: 60 },
	{ id: 'crispbread', category: 'bread', nameDe: 'Knäckebrot', nameEn: 'Crispbread', kcalPer100: 333, proteinPer100: 10, fatPer100: 2.5, carbsPer100: 65, sugarPer100: 1.7, fiberPer100: 16, saltPer100: 1.1, defaultPieceWeight: 10 },
	{ id: 'tortilla-wheat', category: 'bread', nameDe: 'Weizen-Tortilla', nameEn: 'Wheat tortilla', keywordsDe: 'wrap,tortilla', keywordsEn: 'wrap', kcalPer100: 304, proteinPer100: 8.2, fatPer100: 7.6, carbsPer100: 50, sugarPer100: 2.9, fiberPer100: 2.9, saltPer100: 1.5, defaultPieceWeight: 65 },

	// ============== MILCHPRODUKTE ==============
	{ id: 'milk-15', category: 'dairy', nameDe: 'Milch 1,5%', nameEn: 'Milk 1.5%', keywordsDe: 'kuhmilch,milch fettarm', keywordsEn: 'low fat milk', kcalPer100: 47, proteinPer100: 3.4, fatPer100: 1.5, carbsPer100: 4.8, sugarPer100: 4.8, fiberPer100: 0, saltPer100: 0.1, defaultUnit: 'ml' },
	{ id: 'milk-35', category: 'dairy', nameDe: 'Vollmilch 3,5%', nameEn: 'Whole milk 3.5%', kcalPer100: 64, proteinPer100: 3.3, fatPer100: 3.5, carbsPer100: 4.7, sugarPer100: 4.7, fiberPer100: 0, saltPer100: 0.1, defaultUnit: 'ml' },
	{ id: 'milk-oat', category: 'dairy', nameDe: 'Hafermilch', nameEn: 'Oat milk', keywordsDe: 'haferdrink', keywordsEn: 'oat drink', kcalPer100: 47, proteinPer100: 1, fatPer100: 1.5, carbsPer100: 7, sugarPer100: 4.1, fiberPer100: 0.8, saltPer100: 0.1, defaultUnit: 'ml' },
	{ id: 'milk-almond', category: 'dairy', nameDe: 'Mandelmilch', nameEn: 'Almond milk', keywordsDe: 'mandeldrink', keywordsEn: 'almond drink', kcalPer100: 24, proteinPer100: 0.5, fatPer100: 1.6, carbsPer100: 2.1, sugarPer100: 2.1, fiberPer100: 0.4, saltPer100: 0.1, defaultUnit: 'ml' },
	{ id: 'milk-soy', category: 'dairy', nameDe: 'Sojamilch', nameEn: 'Soy milk', keywordsDe: 'sojadrink', keywordsEn: 'soy drink', kcalPer100: 41, proteinPer100: 3.3, fatPer100: 1.8, carbsPer100: 2.5, sugarPer100: 2.5, fiberPer100: 0.5, saltPer100: 0.1, defaultUnit: 'ml' },
	{ id: 'yogurt-plain', category: 'dairy', nameDe: 'Joghurt natur', nameEn: 'Yogurt plain', keywordsDe: 'naturjoghurt', keywordsEn: 'plain yogurt', kcalPer100: 61, proteinPer100: 3.5, fatPer100: 3.3, carbsPer100: 4.7, sugarPer100: 4.7, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'yogurt-greek', category: 'dairy', nameDe: 'Griechischer Joghurt', nameEn: 'Greek yogurt', keywordsDe: 'griechischer joghurt 10%', keywordsEn: 'greek yoghurt', kcalPer100: 116, proteinPer100: 6, fatPer100: 10, carbsPer100: 3, sugarPer100: 3, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'skyr', category: 'dairy', nameDe: 'Skyr', nameEn: 'Skyr', kcalPer100: 64, proteinPer100: 11, fatPer100: 0.5, carbsPer100: 4, sugarPer100: 4, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'quark-low', category: 'dairy', nameDe: 'Magerquark', nameEn: 'Low-fat quark', keywordsDe: 'speisequark', keywordsEn: 'quark', kcalPer100: 67, proteinPer100: 12, fatPer100: 0.2, carbsPer100: 4, sugarPer100: 4, fiberPer100: 0, saltPer100: 0.05 },
	{ id: 'quark-20', category: 'dairy', nameDe: 'Quark 20%', nameEn: 'Quark 20%', kcalPer100: 109, proteinPer100: 11, fatPer100: 5, carbsPer100: 3.5, sugarPer100: 3.5, fiberPer100: 0, saltPer100: 0.05 },
	{ id: 'cottage-cheese', category: 'dairy', nameDe: 'Hüttenkäse', nameEn: 'Cottage cheese', keywordsDe: 'körniger frischkäse', keywordsEn: 'cottage', kcalPer100: 98, proteinPer100: 11, fatPer100: 4.3, carbsPer100: 3.4, sugarPer100: 2.7, fiberPer100: 0, saltPer100: 0.3 },
	{ id: 'cream-cheese', category: 'dairy', nameDe: 'Frischkäse', nameEn: 'Cream cheese', kcalPer100: 253, proteinPer100: 7.5, fatPer100: 24, carbsPer100: 3.3, sugarPer100: 3.3, fiberPer100: 0, saltPer100: 0.8 },
	{ id: 'butter', category: 'dairy', nameDe: 'Butter', nameEn: 'Butter', kcalPer100: 717, proteinPer100: 0.9, fatPer100: 81, carbsPer100: 0.1, sugarPer100: 0.1, fiberPer100: 0, saltPer100: 0.04 },
	{ id: 'cream-30', category: 'dairy', nameDe: 'Sahne 30%', nameEn: 'Cream 30%', keywordsDe: 'schlagsahne,obers', keywordsEn: 'whipping cream', kcalPer100: 290, proteinPer100: 2.5, fatPer100: 30, carbsPer100: 2.9, sugarPer100: 2.9, fiberPer100: 0, saltPer100: 0.1, defaultUnit: 'ml' },
	{ id: 'sour-cream', category: 'dairy', nameDe: 'Saure Sahne', nameEn: 'Sour cream', keywordsDe: 'schmand', keywordsEn: 'creme fraiche', kcalPer100: 200, proteinPer100: 2.5, fatPer100: 20, carbsPer100: 3, sugarPer100: 3, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'cheese-gouda', category: 'dairy', nameDe: 'Gouda', nameEn: 'Gouda', kcalPer100: 356, proteinPer100: 25, fatPer100: 28, carbsPer100: 2.2, sugarPer100: 0, fiberPer100: 0, saltPer100: 1.8 },
	{ id: 'cheese-mozzarella', category: 'dairy', nameDe: 'Mozzarella', nameEn: 'Mozzarella', kcalPer100: 254, proteinPer100: 18, fatPer100: 20, carbsPer100: 2.2, sugarPer100: 1, fiberPer100: 0, saltPer100: 0.5 },
	{ id: 'cheese-feta', category: 'dairy', nameDe: 'Feta', nameEn: 'Feta', keywordsDe: 'schafskäse', keywordsEn: 'sheep cheese', kcalPer100: 264, proteinPer100: 14, fatPer100: 21, carbsPer100: 4.1, sugarPer100: 4.1, fiberPer100: 0, saltPer100: 3 },
	{ id: 'cheese-parmesan', category: 'dairy', nameDe: 'Parmesan', nameEn: 'Parmesan', kcalPer100: 392, proteinPer100: 36, fatPer100: 28, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 3.4 },
	{ id: 'cheese-camembert', category: 'dairy', nameDe: 'Camembert', nameEn: 'Camembert', keywordsDe: 'brie', keywordsEn: 'brie', kcalPer100: 300, proteinPer100: 20, fatPer100: 24, carbsPer100: 0.5, sugarPer100: 0.5, fiberPer100: 0, saltPer100: 2 },

	// ============== FLEISCH / WURST ==============
	{ id: 'chicken-breast-raw', category: 'meat', nameDe: 'Hähnchenbrust roh', nameEn: 'Chicken breast raw', keywordsDe: 'hühnerbrust,pute', keywordsEn: 'chicken,poultry', kcalPer100: 110, proteinPer100: 23, fatPer100: 1.7, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'chicken-breast-cooked', category: 'meat', nameDe: 'Hähnchenbrust gebraten', nameEn: 'Chicken breast cooked', kcalPer100: 165, proteinPer100: 31, fatPer100: 3.6, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.2 },
	{ id: 'turkey-breast-raw', category: 'meat', nameDe: 'Putenbrust roh', nameEn: 'Turkey breast raw', kcalPer100: 104, proteinPer100: 24, fatPer100: 1, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'beef-mince-raw', category: 'meat', nameDe: 'Rinderhack roh', nameEn: 'Beef mince raw', keywordsDe: 'hackfleisch rind', keywordsEn: 'ground beef', kcalPer100: 217, proteinPer100: 17, fatPer100: 16, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.2 },
	{ id: 'pork-mince-raw', category: 'meat', nameDe: 'Schweinehack roh', nameEn: 'Pork mince raw', keywordsDe: 'hackfleisch schwein', keywordsEn: 'ground pork', kcalPer100: 263, proteinPer100: 17, fatPer100: 21, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.2 },
	{ id: 'pork-schnitzel-raw', category: 'meat', nameDe: 'Schweineschnitzel roh', nameEn: 'Pork schnitzel raw', kcalPer100: 143, proteinPer100: 22, fatPer100: 6, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'beef-steak-raw', category: 'meat', nameDe: 'Rindersteak roh', nameEn: 'Beef steak raw', keywordsDe: 'rumpsteak,filet', keywordsEn: 'rumpsteak,fillet', kcalPer100: 162, proteinPer100: 22, fatPer100: 8, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'ham-cooked', category: 'meat', nameDe: 'Kochschinken', nameEn: 'Cooked ham', keywordsDe: 'schinken', keywordsEn: 'ham', kcalPer100: 110, proteinPer100: 21, fatPer100: 3, carbsPer100: 0.5, sugarPer100: 0.5, fiberPer100: 0, saltPer100: 2.3 },
	{ id: 'ham-raw', category: 'meat', nameDe: 'Rohschinken', nameEn: 'Cured ham', keywordsDe: 'serrano,parma', keywordsEn: 'prosciutto,serrano', kcalPer100: 246, proteinPer100: 28, fatPer100: 15, carbsPer100: 0.4, sugarPer100: 0.4, fiberPer100: 0, saltPer100: 5 },
	{ id: 'bacon', category: 'meat', nameDe: 'Speck', nameEn: 'Bacon', kcalPer100: 541, proteinPer100: 37, fatPer100: 42, carbsPer100: 1.4, sugarPer100: 0, fiberPer100: 0, saltPer100: 4 },
	{ id: 'salami', category: 'meat', nameDe: 'Salami', nameEn: 'Salami', kcalPer100: 425, proteinPer100: 21, fatPer100: 37, carbsPer100: 1.6, sugarPer100: 0, fiberPer100: 0, saltPer100: 4.5 },
	{ id: 'sausage-bratwurst', category: 'meat', nameDe: 'Bratwurst', nameEn: 'Bratwurst', kcalPer100: 305, proteinPer100: 12, fatPer100: 27, carbsPer100: 3, sugarPer100: 0, fiberPer100: 0, saltPer100: 2, defaultPieceWeight: 110 },
	{ id: 'sausage-wiener', category: 'meat', nameDe: 'Wiener Würstchen', nameEn: 'Frankfurter', keywordsDe: 'wiener,frankfurter', keywordsEn: 'wiener,hot dog', kcalPer100: 263, proteinPer100: 12, fatPer100: 23, carbsPer100: 2, sugarPer100: 0.5, fiberPer100: 0, saltPer100: 2.2, defaultPieceWeight: 50 },
	{ id: 'lyoner', category: 'meat', nameDe: 'Lyoner', nameEn: 'Bologna', keywordsDe: 'fleischwurst', keywordsEn: 'bologna', kcalPer100: 280, proteinPer100: 12, fatPer100: 25, carbsPer100: 1, sugarPer100: 0, fiberPer100: 0, saltPer100: 2.5 },

	// ============== FISCH ==============
	{ id: 'salmon-raw', category: 'fish', nameDe: 'Lachs roh', nameEn: 'Salmon raw', kcalPer100: 208, proteinPer100: 20, fatPer100: 13, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'salmon-smoked', category: 'fish', nameDe: 'Räucherlachs', nameEn: 'Smoked salmon', kcalPer100: 117, proteinPer100: 18, fatPer100: 4.3, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 4 },
	{ id: 'tuna-can-water', category: 'fish', nameDe: 'Thunfisch in Wasser', nameEn: 'Tuna in water', keywordsDe: 'thunfisch dose', keywordsEn: 'canned tuna', kcalPer100: 116, proteinPer100: 26, fatPer100: 1, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.9 },
	{ id: 'tuna-can-oil', category: 'fish', nameDe: 'Thunfisch in Öl', nameEn: 'Tuna in oil', kcalPer100: 198, proteinPer100: 25, fatPer100: 10, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.9 },
	{ id: 'cod-raw', category: 'fish', nameDe: 'Kabeljau roh', nameEn: 'Cod raw', keywordsDe: 'dorsch', keywordsEn: 'cod', kcalPer100: 82, proteinPer100: 18, fatPer100: 0.7, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.2 },
	{ id: 'trout-raw', category: 'fish', nameDe: 'Forelle roh', nameEn: 'Trout raw', kcalPer100: 119, proteinPer100: 20, fatPer100: 3.5, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.1 },
	{ id: 'shrimp', category: 'fish', nameDe: 'Garnelen', nameEn: 'Shrimp', keywordsDe: 'shrimps,scampi', keywordsEn: 'prawns', kcalPer100: 99, proteinPer100: 24, fatPer100: 0.3, carbsPer100: 0.2, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.8 },
	{ id: 'herring-pickled', category: 'fish', nameDe: 'Matjes', nameEn: 'Pickled herring', keywordsDe: 'hering', keywordsEn: 'herring', kcalPer100: 217, proteinPer100: 14, fatPer100: 17, carbsPer100: 0.6, sugarPer100: 0.6, fiberPer100: 0, saltPer100: 2 },

	// ============== EIER / HÜLSENFRÜCHTE ==============
	{ id: 'egg-raw', category: 'protein', nameDe: 'Ei', nameEn: 'Egg', keywordsDe: 'hühnerei,eier', keywordsEn: 'eggs', kcalPer100: 143, proteinPer100: 12.6, fatPer100: 9.5, carbsPer100: 1.1, sugarPer100: 1.1, fiberPer100: 0, saltPer100: 0.4, defaultPieceWeight: 58 },
	{ id: 'egg-boiled', category: 'protein', nameDe: 'Ei gekocht', nameEn: 'Egg boiled', kcalPer100: 155, proteinPer100: 13, fatPer100: 11, carbsPer100: 1.1, sugarPer100: 1.1, fiberPer100: 0, saltPer100: 0.4, defaultPieceWeight: 58 },
	{ id: 'lentils-cooked', category: 'protein', nameDe: 'Linsen gekocht', nameEn: 'Lentils cooked', keywordsDe: 'linse', keywordsEn: 'lentil', kcalPer100: 116, proteinPer100: 9, fatPer100: 0.4, carbsPer100: 20, sugarPer100: 1.8, fiberPer100: 7.9, saltPer100: 0.01 },
	{ id: 'chickpeas-cooked', category: 'protein', nameDe: 'Kichererbsen gekocht', nameEn: 'Chickpeas cooked', keywordsDe: 'kichererbse,garbanzo', keywordsEn: 'garbanzo', kcalPer100: 164, proteinPer100: 8.9, fatPer100: 2.6, carbsPer100: 27, sugarPer100: 4.8, fiberPer100: 7.6, saltPer100: 0.02 },
	{ id: 'beans-kidney-cooked', category: 'protein', nameDe: 'Kidneybohnen gekocht', nameEn: 'Kidney beans cooked', kcalPer100: 127, proteinPer100: 8.7, fatPer100: 0.5, carbsPer100: 23, sugarPer100: 0.3, fiberPer100: 6.4, saltPer100: 0.01 },
	{ id: 'beans-white-cooked', category: 'protein', nameDe: 'Weiße Bohnen gekocht', nameEn: 'White beans cooked', kcalPer100: 139, proteinPer100: 9.7, fatPer100: 0.4, carbsPer100: 25, sugarPer100: 0.3, fiberPer100: 6.3, saltPer100: 0.01 },
	{ id: 'tofu-firm', category: 'protein', nameDe: 'Tofu natur', nameEn: 'Tofu firm', kcalPer100: 144, proteinPer100: 17, fatPer100: 9, carbsPer100: 2.8, sugarPer100: 0.6, fiberPer100: 2.3, saltPer100: 0.02 },
	{ id: 'tempeh', category: 'protein', nameDe: 'Tempeh', nameEn: 'Tempeh', kcalPer100: 192, proteinPer100: 20, fatPer100: 11, carbsPer100: 7.6, sugarPer100: 0, fiberPer100: 0, saltPer100: 0.02 },

	// ============== NÜSSE / SAMEN ==============
	{ id: 'almonds', category: 'nuts', nameDe: 'Mandeln', nameEn: 'Almonds', keywordsDe: 'mandel', keywordsEn: 'almond', kcalPer100: 579, proteinPer100: 21, fatPer100: 50, carbsPer100: 22, sugarPer100: 4.4, fiberPer100: 13, saltPer100: 0 },
	{ id: 'walnuts', category: 'nuts', nameDe: 'Walnüsse', nameEn: 'Walnuts', keywordsDe: 'walnuss', keywordsEn: 'walnut', kcalPer100: 654, proteinPer100: 15, fatPer100: 65, carbsPer100: 14, sugarPer100: 2.6, fiberPer100: 6.7, saltPer100: 0 },
	{ id: 'cashews', category: 'nuts', nameDe: 'Cashewkerne', nameEn: 'Cashews', keywordsDe: 'cashew', keywordsEn: 'cashew', kcalPer100: 553, proteinPer100: 18, fatPer100: 44, carbsPer100: 30, sugarPer100: 5.9, fiberPer100: 3.3, saltPer100: 0.03 },
	{ id: 'peanuts', category: 'nuts', nameDe: 'Erdnüsse', nameEn: 'Peanuts', keywordsDe: 'erdnuss', keywordsEn: 'peanut', kcalPer100: 567, proteinPer100: 26, fatPer100: 49, carbsPer100: 16, sugarPer100: 4.7, fiberPer100: 8.5, saltPer100: 0.04 },
	{ id: 'peanut-butter', category: 'nuts', nameDe: 'Erdnussbutter', nameEn: 'Peanut butter', kcalPer100: 588, proteinPer100: 25, fatPer100: 50, carbsPer100: 20, sugarPer100: 9.2, fiberPer100: 6, saltPer100: 1.4 },
	{ id: 'hazelnuts', category: 'nuts', nameDe: 'Haselnüsse', nameEn: 'Hazelnuts', keywordsDe: 'haselnuss', keywordsEn: 'hazelnut', kcalPer100: 628, proteinPer100: 15, fatPer100: 61, carbsPer100: 17, sugarPer100: 4.3, fiberPer100: 9.7, saltPer100: 0 },
	{ id: 'pistachios', category: 'nuts', nameDe: 'Pistazien', nameEn: 'Pistachios', kcalPer100: 562, proteinPer100: 20, fatPer100: 45, carbsPer100: 28, sugarPer100: 7.7, fiberPer100: 10, saltPer100: 0 },
	{ id: 'sunflower-seeds', category: 'nuts', nameDe: 'Sonnenblumenkerne', nameEn: 'Sunflower seeds', kcalPer100: 584, proteinPer100: 21, fatPer100: 51, carbsPer100: 20, sugarPer100: 2.6, fiberPer100: 8.6, saltPer100: 0 },
	{ id: 'chia-seeds', category: 'nuts', nameDe: 'Chiasamen', nameEn: 'Chia seeds', kcalPer100: 486, proteinPer100: 17, fatPer100: 31, carbsPer100: 42, sugarPer100: 0, fiberPer100: 34, saltPer100: 0 },
	{ id: 'flax-seeds', category: 'nuts', nameDe: 'Leinsamen', nameEn: 'Flax seeds', keywordsDe: 'leinsaat', keywordsEn: 'linseed', kcalPer100: 534, proteinPer100: 18, fatPer100: 42, carbsPer100: 29, sugarPer100: 1.5, fiberPer100: 27, saltPer100: 0.08 },

	// ============== FETTE / ÖLE ==============
	{ id: 'olive-oil', category: 'fat', nameDe: 'Olivenöl', nameEn: 'Olive oil', kcalPer100: 884, proteinPer100: 0, fatPer100: 100, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'rapeseed-oil', category: 'fat', nameDe: 'Rapsöl', nameEn: 'Rapeseed oil', keywordsEn: 'canola oil', kcalPer100: 884, proteinPer100: 0, fatPer100: 100, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'sunflower-oil', category: 'fat', nameDe: 'Sonnenblumenöl', nameEn: 'Sunflower oil', kcalPer100: 884, proteinPer100: 0, fatPer100: 100, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'coconut-oil', category: 'fat', nameDe: 'Kokosöl', nameEn: 'Coconut oil', kcalPer100: 892, proteinPer100: 0, fatPer100: 99, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'margarine', category: 'fat', nameDe: 'Margarine', nameEn: 'Margarine', kcalPer100: 717, proteinPer100: 0.2, fatPer100: 80, carbsPer100: 0.4, sugarPer100: 0, fiberPer100: 0, saltPer100: 1 },
	{ id: 'mayonnaise', category: 'fat', nameDe: 'Mayonnaise', nameEn: 'Mayonnaise', keywordsDe: 'mayo', keywordsEn: 'mayo', kcalPer100: 680, proteinPer100: 1, fatPer100: 75, carbsPer100: 1.3, sugarPer100: 0.5, fiberPer100: 0, saltPer100: 1.3 },

	// ============== GETRÄNKE ==============
	{ id: 'water', category: 'drink', nameDe: 'Wasser', nameEn: 'Water', keywordsDe: 'mineralwasser,leitungswasser', keywordsEn: 'mineral water', kcalPer100: 0, proteinPer100: 0, fatPer100: 0, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'coffee-black', category: 'drink', nameDe: 'Kaffee schwarz', nameEn: 'Coffee black', keywordsDe: 'filterkaffee,schwarzer kaffee', keywordsEn: 'filter coffee,black coffee', kcalPer100: 2, proteinPer100: 0.1, fatPer100: 0, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'espresso', category: 'drink', nameDe: 'Espresso', nameEn: 'Espresso', keywordsDe: 'kaffee', keywordsEn: 'coffee', kcalPer100: 9, proteinPer100: 0.1, fatPer100: 0.2, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'cappuccino', category: 'drink', nameDe: 'Cappuccino', nameEn: 'Cappuccino', keywordsDe: 'kaffee,milchkaffee', keywordsEn: 'coffee', kcalPer100: 50, proteinPer100: 2.7, fatPer100: 2.6, carbsPer100: 3.8, sugarPer100: 3.8, fiberPer100: 0, saltPer100: 0.08, defaultUnit: 'ml' },
	{ id: 'latte-macchiato', category: 'drink', nameDe: 'Latte Macchiato', nameEn: 'Latte Macchiato', keywordsDe: 'kaffee,milchkaffee,caffe latte', keywordsEn: 'coffee,caffe latte', kcalPer100: 55, proteinPer100: 2.9, fatPer100: 2.9, carbsPer100: 4.2, sugarPer100: 4.2, fiberPer100: 0, saltPer100: 0.08, defaultUnit: 'ml' },
	{ id: 'tea-black', category: 'drink', nameDe: 'Tee', nameEn: 'Tea', keywordsDe: 'schwarztee,grüner tee', keywordsEn: 'black tea,green tea', kcalPer100: 1, proteinPer100: 0, fatPer100: 0, carbsPer100: 0.3, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'orange-juice', category: 'drink', nameDe: 'Orangensaft', nameEn: 'Orange juice', keywordsDe: 'o-saft', keywordsEn: 'oj', kcalPer100: 45, proteinPer100: 0.7, fatPer100: 0.2, carbsPer100: 10, sugarPer100: 8.4, fiberPer100: 0.2, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'apple-juice', category: 'drink', nameDe: 'Apfelsaft', nameEn: 'Apple juice', kcalPer100: 46, proteinPer100: 0.1, fatPer100: 0.1, carbsPer100: 11, sugarPer100: 9.6, fiberPer100: 0.2, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'apple-spritzer', category: 'drink', nameDe: 'Apfelschorle', nameEn: 'Apple spritzer', kcalPer100: 22, proteinPer100: 0.1, fatPer100: 0, carbsPer100: 5.4, sugarPer100: 5, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'cola', category: 'drink', nameDe: 'Cola', nameEn: 'Coke', keywordsDe: 'coca cola,limo', keywordsEn: 'coca cola,soda', kcalPer100: 42, proteinPer100: 0, fatPer100: 0, carbsPer100: 11, sugarPer100: 11, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'cola-zero', category: 'drink', nameDe: 'Cola Zero', nameEn: 'Coke Zero', keywordsDe: 'cola light,coke zero', keywordsEn: 'diet coke', kcalPer100: 0.2, proteinPer100: 0, fatPer100: 0, carbsPer100: 0, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'beer', category: 'drink', nameDe: 'Bier', nameEn: 'Beer', keywordsDe: 'pils,lager,helles', keywordsEn: 'lager,pilsner', kcalPer100: 43, proteinPer100: 0.5, fatPer100: 0, carbsPer100: 3.6, sugarPer100: 0, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'wine-red', category: 'drink', nameDe: 'Rotwein', nameEn: 'Red wine', kcalPer100: 85, proteinPer100: 0.1, fatPer100: 0, carbsPer100: 2.6, sugarPer100: 0.6, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'wine-white', category: 'drink', nameDe: 'Weißwein', nameEn: 'White wine', kcalPer100: 82, proteinPer100: 0.1, fatPer100: 0, carbsPer100: 2.6, sugarPer100: 1, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },
	{ id: 'sparkling-wine', category: 'drink', nameDe: 'Sekt', nameEn: 'Sparkling wine', keywordsDe: 'prosecco,champagner', keywordsEn: 'champagne,prosecco', kcalPer100: 80, proteinPer100: 0.2, fatPer100: 0, carbsPer100: 2.5, sugarPer100: 1.7, fiberPer100: 0, saltPer100: 0, defaultUnit: 'ml' },

	// ============== SÜSSES / SNACKS ==============
	{ id: 'sugar', category: 'sweet', nameDe: 'Zucker', nameEn: 'Sugar', keywordsDe: 'haushaltszucker', keywordsEn: 'white sugar', kcalPer100: 387, proteinPer100: 0, fatPer100: 0, carbsPer100: 100, sugarPer100: 100, fiberPer100: 0, saltPer100: 0 },
	{ id: 'honey', category: 'sweet', nameDe: 'Honig', nameEn: 'Honey', kcalPer100: 304, proteinPer100: 0.3, fatPer100: 0, carbsPer100: 82, sugarPer100: 82, fiberPer100: 0.2, saltPer100: 0 },
	{ id: 'jam', category: 'sweet', nameDe: 'Marmelade', nameEn: 'Jam', keywordsDe: 'konfitüre', keywordsEn: 'preserve', kcalPer100: 278, proteinPer100: 0.4, fatPer100: 0.1, carbsPer100: 69, sugarPer100: 49, fiberPer100: 1.1, saltPer100: 0.03 },
	{ id: 'nutella', category: 'sweet', nameDe: 'Nuss-Nougat-Creme', nameEn: 'Hazelnut spread', keywordsDe: 'nutella,nuss nougat', keywordsEn: 'nutella', kcalPer100: 539, proteinPer100: 6.3, fatPer100: 31, carbsPer100: 57, sugarPer100: 56, fiberPer100: 3.4, saltPer100: 0.1 },
	{ id: 'chocolate-dark', category: 'sweet', nameDe: 'Zartbitterschokolade', nameEn: 'Dark chocolate', keywordsDe: 'edelbitter,bitterschokolade', keywordsEn: 'dark chocolate', kcalPer100: 546, proteinPer100: 4.9, fatPer100: 31, carbsPer100: 61, sugarPer100: 48, fiberPer100: 7, saltPer100: 0.02 },
	{ id: 'chocolate-milk', category: 'sweet', nameDe: 'Vollmilchschokolade', nameEn: 'Milk chocolate', kcalPer100: 535, proteinPer100: 7.7, fatPer100: 30, carbsPer100: 59, sugarPer100: 52, fiberPer100: 3.4, saltPer100: 0.24 },
	{ id: 'gummybears', category: 'sweet', nameDe: 'Gummibärchen', nameEn: 'Gummy bears', keywordsDe: 'haribo,fruchtgummi', keywordsEn: 'haribo', kcalPer100: 343, proteinPer100: 6.9, fatPer100: 0.1, carbsPer100: 77, sugarPer100: 46, fiberPer100: 0, saltPer100: 0.05 },
	{ id: 'cookies', category: 'sweet', nameDe: 'Kekse', nameEn: 'Cookies', keywordsDe: 'plätzchen,butterkeks', keywordsEn: 'biscuits', kcalPer100: 480, proteinPer100: 6.5, fatPer100: 21, carbsPer100: 67, sugarPer100: 32, fiberPer100: 2, saltPer100: 0.6 },
	{ id: 'cake-marble', category: 'sweet', nameDe: 'Marmorkuchen', nameEn: 'Marble cake', kcalPer100: 420, proteinPer100: 5.5, fatPer100: 21, carbsPer100: 51, sugarPer100: 30, fiberPer100: 1, saltPer100: 0.5 },
	{ id: 'ice-cream-vanilla', category: 'sweet', nameDe: 'Vanilleeis', nameEn: 'Vanilla ice cream', keywordsDe: 'eis,speiseeis', keywordsEn: 'ice cream', kcalPer100: 207, proteinPer100: 3.5, fatPer100: 11, carbsPer100: 24, sugarPer100: 21, fiberPer100: 0.7, saltPer100: 0.16 },
	{ id: 'chips-paprika', category: 'sweet', nameDe: 'Kartoffelchips', nameEn: 'Potato chips', keywordsDe: 'chips,paprika chips', keywordsEn: 'crisps', kcalPer100: 543, proteinPer100: 5.7, fatPer100: 34, carbsPer100: 53, sugarPer100: 2.6, fiberPer100: 4.4, saltPer100: 1.4 },
	{ id: 'pretzel-sticks', category: 'sweet', nameDe: 'Salzstangen', nameEn: 'Pretzel sticks', kcalPer100: 384, proteinPer100: 11, fatPer100: 3, carbsPer100: 75, sugarPer100: 1.5, fiberPer100: 3.2, saltPer100: 4.1 },
	{ id: 'protein-bar', category: 'sweet', nameDe: 'Proteinriegel', nameEn: 'Protein bar', kcalPer100: 380, proteinPer100: 33, fatPer100: 13, carbsPer100: 36, sugarPer100: 5, fiberPer100: 8, saltPer100: 0.5, defaultPieceWeight: 60 },

	// ============== SAUCEN / GEWÜRZE ==============
	{ id: 'ketchup', category: 'sauce', nameDe: 'Ketchup', nameEn: 'Ketchup', kcalPer100: 112, proteinPer100: 1.7, fatPer100: 0.4, carbsPer100: 25, sugarPer100: 22, fiberPer100: 0.5, saltPer100: 2.5 },
	{ id: 'mustard', category: 'sauce', nameDe: 'Senf', nameEn: 'Mustard', kcalPer100: 88, proteinPer100: 5, fatPer100: 4, carbsPer100: 7, sugarPer100: 3.5, fiberPer100: 4, saltPer100: 4 },
	{ id: 'tomato-sauce', category: 'sauce', nameDe: 'Tomatensauce', nameEn: 'Tomato sauce', keywordsDe: 'passata', keywordsEn: 'passata', kcalPer100: 35, proteinPer100: 1.6, fatPer100: 0.2, carbsPer100: 7, sugarPer100: 4.5, fiberPer100: 1.5, saltPer100: 0.5 },
	{ id: 'soy-sauce', category: 'sauce', nameDe: 'Sojasauce', nameEn: 'Soy sauce', kcalPer100: 53, proteinPer100: 8, fatPer100: 0, carbsPer100: 5, sugarPer100: 0.4, fiberPer100: 0.8, saltPer100: 14, defaultUnit: 'ml' },
	{ id: 'hummus', category: 'sauce', nameDe: 'Hummus', nameEn: 'Hummus', kcalPer100: 166, proteinPer100: 7.9, fatPer100: 9.6, carbsPer100: 14, sugarPer100: 0.3, fiberPer100: 6, saltPer100: 1 }
];
