type Quote = { de: string; en: string; author: string };

const STORAGE_KEY = 'groly_last_meditation_quote';

export const quotes: Quote[] = [
	// Thich Nhat Hanh
	{ de: 'Atme, du lebst.', en: 'Breathe, you are alive.', author: 'Thich Nhat Hanh' },
	{ de: 'Gefühle kommen und gehen wie Wolken in einem windigen Himmel. Bewusstes Atmen ist mein Anker.', en: 'Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.', author: 'Thich Nhat Hanh' },
	{ de: 'Meditieren bedeutet, nach Hause zu sich selbst zu kommen.', en: 'To meditate means to go home to yourself.', author: 'Thich Nhat Hanh' },
	{ de: 'Lächle, atme und gehe langsam.', en: 'Smile, breathe and go slowly.', author: 'Thich Nhat Hanh' },
	{ de: 'Das kostbarste Geschenk, das wir jemandem machen können, ist unsere Aufmerksamkeit.', en: 'The most precious gift we can offer anyone is our attention.', author: 'Thich Nhat Hanh' },
	{ de: 'Geh, als würdest du die Erde mit deinen Füßen küssen.', en: 'Walk as if you are kissing the Earth with your feet.', author: 'Thich Nhat Hanh' },
	{ de: 'In der Achtsamkeit ist man nicht nur ausgeruht und glücklich, sondern auch aufmerksam und wach.', en: 'In mindfulness one is not only restful and happy, but alert and awake.', author: 'Thich Nhat Hanh' },
	{ de: 'Das Leben ist nur im gegenwärtigen Augenblick verfügbar.', en: 'Life is available only in the present moment.', author: 'Thich Nhat Hanh' },
	{ de: 'Manchmal ist deine Freude der Ursprung deines Lächelns – aber manchmal kann dein Lächeln der Ursprung deiner Freude sein.', en: 'Sometimes your joy is the source of your smile, but sometimes your smile can be the source of your joy.', author: 'Thich Nhat Hanh' },
	{ de: 'Der gegenwärtige Augenblick ist der einzige Moment, der uns offensteht – und er ist die Tür zu allen Momenten.', en: 'The present moment is the only moment available to us, and it is the door to all moments.', author: 'Thich Nhat Hanh' },
	{ de: 'Durch tiefes Zuhören und mitfühlende Worte können wir anderen helfen, zu leiden aufzuhören.', en: 'Through deep listening and loving speech, we can help others suffer less.', author: 'Thich Nhat Hanh' },

	// Eckhart Tolle
	{ de: 'Erkenne tief, dass der gegenwärtige Moment alles ist, was du hast.', en: 'Realize deeply that the present moment is all you have.', author: 'Eckhart Tolle' },
	{ de: 'Die eigentliche Ursache des Unglücklichseins ist nie die Situation, sondern deine Gedanken darüber.', en: 'The primary cause of unhappiness is never the situation but your thoughts about it.', author: 'Eckhart Tolle' },
	{ de: 'Du bist nicht dein Geist.', en: 'You are not your mind.', author: 'Eckhart Tolle' },
	{ de: 'Was auch immer der gegenwärtige Augenblick enthält, akzeptiere es, als hättest du es gewählt.', en: 'Whatever the present moment contains, accept it as if you had chosen it.', author: 'Eckhart Tolle' },
	{ de: 'Wenn du dich mit dem gegenwärtigen Augenblick befreundest, fühlst du dich überall zu Hause.', en: 'When you make friends with the present moment, you feel at home no matter where you are.', author: 'Eckhart Tolle' },
	{ de: 'Das Leben ist der Tänzer und du bist der Tanz.', en: 'Life is the dancer and you are the dance.', author: 'Eckhart Tolle' },
	{ de: 'In der Stille findet man Kreativität und Lösungen für Probleme.', en: 'Stillness is where creativity and solutions to problems are found.', author: 'Eckhart Tolle' },
	{ de: 'Es ist nicht selten, dass Menschen ihr ganzes Leben damit verbringen, auf den Beginn des Lebens zu warten.', en: 'It is not uncommon for people to spend their whole life waiting to start living.', author: 'Eckhart Tolle' },
	{ de: 'Der gegenwärtige Moment wird immer gewesen sein.', en: 'The present moment always will have been.', author: 'Eckhart Tolle' },

	// Buddha / Buddhismus
	{ de: 'Frieden kommt von innen. Suche ihn nicht außen.', en: 'Peace comes from within. Do not seek it without.', author: 'Buddha' },
	{ de: 'Was du denkst, das wirst du.', en: 'What you think, you become.', author: 'Buddha' },
	{ de: 'Verweile nicht in der Vergangenheit, träume nicht von der Zukunft – richte deinen Geist auf den gegenwärtigen Augenblick.', en: 'Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.', author: 'Buddha' },
	{ de: 'Jeden Morgen werden wir neu geboren. Was wir heute tun, ist das, was am meisten zählt.', en: 'Every morning we are born again. What we do today is what matters most.', author: 'Buddha' },
	{ de: 'Nichts ist für immer außer dem Wandel.', en: 'Nothing is forever except change.', author: 'Buddha' },
	{ de: 'Das Geheimnis der Gesundheit liegt darin, den gegenwärtigen Moment weise und aufrichtig zu leben.', en: 'The secret of health is to live the present moment wisely and earnestly.', author: 'Buddha' },
	{ de: 'Du selbst verdienst genauso wie jeder andere im ganzen Universum deine Liebe und Zuneigung.', en: 'You yourself, as much as anybody in the entire universe, deserve your love and affection.', author: 'Buddha' },
	{ de: 'An Wut festzuhalten ist wie das Greifen nach einer heißen Kohle – du bist es, der sich verbrennt.', en: 'Holding on to anger is like grasping a hot coal with the intent of throwing it at someone else; you are the one who gets burned.', author: 'Buddha' },
	{ de: 'Tausend Kerzen können von einer einzigen Kerze entzündet werden, ohne dass ihr Leben verkürzt wird.', en: 'Thousands of candles can be lit from a single candle, and the life of the candle will not be shortened.', author: 'Buddha' },
	{ de: 'Mit deinen Gedanken formst du die Welt.', en: 'With your thoughts you make the world.', author: 'Buddha' },

	// Marcus Aurelius
	{ de: 'Du hast Macht über deinen Geist – nicht über äußere Ereignisse. Erkenne das, und du wirst Stärke finden.', en: 'You have power over your mind – not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
	{ de: 'Sehr wenig ist nötig, um ein glückliches Leben zu führen; es liegt alles in dir selbst, in deiner Denkweise.', en: 'Very little is needed to make a happy life; it is all within yourself, in your way of thinking.', author: 'Marcus Aurelius' },
	{ de: 'Das Glück deines Lebens hängt von der Qualität deiner Gedanken ab.', en: 'The happiness of your life depends upon the quality of your thoughts.', author: 'Marcus Aurelius' },
	{ de: 'Beschränke dich auf die Gegenwart.', en: 'Confine yourself to the present.', author: 'Marcus Aurelius' },
	{ de: 'Verschwende keine Zeit mehr damit, über einen guten Menschen zu diskutieren. Sei einer.', en: 'Waste no more time arguing about what a good person should be. Be one.', author: 'Marcus Aurelius' },
	{ de: 'Wenn du morgens aufwachst, denke daran, welch ein Privileg es ist, zu leben, zu atmen, zu denken, zu genießen und zu lieben.', en: 'When you wake up in the morning, think of what a privilege it is to be alive, to breathe, to think, to enjoy, to love.', author: 'Marcus Aurelius' },
	{ de: 'Alles, was wir hören, ist eine Meinung, kein Fakt. Alles, was wir sehen, ist eine Perspektive, nicht die Wahrheit.', en: 'Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.', author: 'Marcus Aurelius' },
	{ de: 'Zähle die Segnungen, die du besitzt – nicht die, die du dir wünschst.', en: 'Count the blessings you possess – not the ones you wish for.', author: 'Marcus Aurelius' },

	// Lao Tzu
	{ de: 'Dem stillen Geist ergibt sich das ganze Universum.', en: 'To the mind that is still, the whole universe surrenders.', author: 'Lao Tzu' },
	{ de: 'Andere zu kennen ist Weisheit. Sich selbst zu kennen ist Erleuchtung.', en: 'Knowing others is wisdom. Knowing yourself is enlightenment.', author: 'Lao Tzu' },
	{ de: 'Die Natur eilt nicht, und doch wird alles vollbracht.', en: 'Nature does not hurry, yet everything is accomplished.', author: 'Lao Tzu' },
	{ de: 'Stille ist eine Quelle großer Kraft.', en: 'Silence is a source of great strength.', author: 'Lao Tzu' },
	{ de: 'Wenn ich loslasse, was ich bin, werde ich, was ich sein könnte.', en: 'When I let go of what I am, I become what I might be.', author: 'Lao Tzu' },
	{ de: 'Eine Reise von tausend Meilen beginnt mit einem einzigen Schritt.', en: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
	{ de: 'Wer anderen kennt, ist klug. Wer sich selbst kennt, ist erleuchtet.', en: 'He who knows others is wise. He who knows himself is enlightened.', author: 'Lao Tzu' },
	{ de: 'Handle ohne zu handeln, arbeite ohne Anstrengung.', en: 'Act without acting, work without effort.', author: 'Lao Tzu' },

	// Rumi
	{ de: 'Jenseits von Falsch und Richtig liegt ein Feld. Dort treffen wir uns.', en: 'Out beyond ideas of wrongdoing and rightdoing, there is a field. I\'ll meet you there.', author: 'Rumi' },
	{ de: 'Gestern war ich klug, also wollte ich die Welt verändern. Heute bin ich weise, also verändere ich mich selbst.', en: 'Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.', author: 'Rumi' },
	{ de: 'Was du suchst, sucht dich.', en: 'What you seek is seeking you.', author: 'Rumi' },
	{ de: 'Lass die Stille dich zum Kern des Lebens führen.', en: 'Let silence take you to the core of life.', author: 'Rumi' },
	{ de: 'Du bist nicht ein Tropfen im Ozean. Du bist der gesamte Ozean in einem Tropfen.', en: 'You are not a drop in the ocean. You are the entire ocean in a drop.', author: 'Rumi' },
	{ de: 'Wunden sind die Orte, an denen das Licht in dich eintritt.', en: 'The wound is the place where the light enters you.', author: 'Rumi' },

	// Jon Kabat-Zinn
	{ de: 'Wohin du auch gehst, dort bist du.', en: 'Wherever you go, there you are.', author: 'Jon Kabat-Zinn' },
	{ de: 'Du kannst die Wellen nicht stoppen, aber du kannst lernen zu surfen.', en: 'You can\'t stop the waves, but you can learn to surf.', author: 'Jon Kabat-Zinn' },
	{ de: 'Die kleinen Dinge? Die kleinen Momente? Sie sind nicht klein.', en: 'The little things? The little moments? They aren\'t little.', author: 'Jon Kabat-Zinn' },
	{ de: 'Achtsamkeit bedeutet, auf eine bestimmte Weise aufmerksam zu sein: absichtlich, im gegenwärtigen Moment und ohne zu urteilen.', en: 'Mindfulness means paying attention in a particular way: on purpose, in the present moment, and non-judgmentally.', author: 'Jon Kabat-Zinn' },
	{ de: 'Heilung bedeutet nicht, die Narben verschwinden zu lassen – es bedeutet, sie zu integrieren.', en: 'Healing does not mean that the scars disappear – it means integrating them.', author: 'Jon Kabat-Zinn' },

	// Dalai Lama
	{ de: 'Glück ist nichts Fertiges. Es entsteht durch deine eigenen Handlungen.', en: 'Happiness is not something ready-made. It comes from your own actions.', author: 'Dalai Lama' },
	{ de: 'Wenn du kannst, hilf anderen; wenn du das nicht kannst, schade ihnen zumindest nicht.', en: 'If you can, help others; if you cannot do that, at least do not harm them.', author: 'Dalai Lama' },
	{ de: 'Schlaf ist die beste Meditation.', en: 'Sleep is the best meditation.', author: 'Dalai Lama' },
	{ de: 'Offenheit des Herzens ist das Zeichen echter Stärke.', en: 'Openness of heart is the sign of true strength.', author: 'Dalai Lama' },

	// Alan Watts
	{ de: 'Das wahre Geheimnis des Lebens ist, völlig gegenwärtig bei dem zu sein, was man gerade tut.', en: 'The real secret of life is to be completely engaged with what you are doing in the here and now.', author: 'Alan Watts' },
	{ de: 'Du bist eine Öffnung, durch die das Universum sich selbst betrachtet und erforscht.', en: 'You are an aperture through which the universe is looking at and exploring itself.', author: 'Alan Watts' },
	{ de: 'Trübes Wasser klärt sich am besten, wenn man es in Ruhe lässt.', en: 'Muddy water is best cleared by leaving it alone.', author: 'Alan Watts' },
	{ de: 'Vertrauen zu haben bedeutet, sich dem Wasser anzuvertrauen.', en: 'To have faith is to trust yourself to the water.', author: 'Alan Watts' },

	// Pema Chödrön
	{ de: 'Du bist der Himmel. Alles andere ist nur das Wetter.', en: 'You are the sky. Everything else is just the weather.', author: 'Pema Chödrön' },
	{ de: 'Neugier ist der Weg. Mitgefühl ist das Ziel.', en: 'Curiosity is the path. Compassion is the goal.', author: 'Pema Chödrön' },
	{ de: 'Beginne dort, wo du bist. Nutze, was du hast. Tu, was du kannst.', en: 'Start where you are. Use what you have. Do what you can.', author: 'Pema Chödrön' },

	// Shunryu Suzuki
	{ de: 'Im Geist des Anfängers gibt es viele Möglichkeiten, im Geist des Experten gibt es wenige.', en: 'In the beginner\'s mind there are many possibilities, but in the expert\'s mind there are few.', author: 'Shunryu Suzuki' },
	{ de: 'Meditiere nicht um Erleuchtung zu erlangen – meditiere, um zu meditieren.', en: 'Do not meditate to gain enlightenment – meditate to meditate.', author: 'Shunryu Suzuki' },

	// Seneca
	{ de: 'Alles andere gehört anderen – nur die Zeit gehört uns.', en: 'Everything else belongs to others – only time is truly ours.', author: 'Seneca' },
	{ de: 'Er ist nirgends, der überall ist.', en: 'He who is everywhere is nowhere.', author: 'Seneca' },
	{ de: 'Ziehe dich in dich selbst zurück, so weit du kannst.', en: 'Retire as much as you can into yourself.', author: 'Seneca' },

	// Viktor Frankl
	{ de: 'Zwischen Reiz und Reaktion liegt ein Raum. In diesem Raum liegt unsere Macht, unsere Antwort zu wählen.', en: 'Between stimulus and response there is a space. In that space is our power to choose our response.', author: 'Viktor Frankl' },

	// Hermann Hesse
	{ de: 'In dir ist eine Stille und ein Heim, zu dem du jederzeit zurückkehren und du selbst sein kannst.', en: 'Within you there is a stillness and a sanctuary to which you can retreat at any time and be yourself.', author: 'Hermann Hesse' },

	// Henry David Thoreau
	{ de: 'Du musst in der Gegenwart leben, dich auf jede Welle stürzen und deine Ewigkeit in jedem Augenblick finden.', en: 'You must live in the present, launch yourself on every wave, find your eternity in each moment.', author: 'Henry David Thoreau' },
	{ de: 'Gehe vertrauensvoll in die Richtung deiner Träume. Lebe das Leben, das du dir vorgestellt hast.', en: 'Go confidently in the direction of your dreams. Live the life you have imagined.', author: 'Henry David Thoreau' },

	// Epictetus
	{ de: 'Nicht das, was uns widerfährt, erschüttert uns – sondern unsere Urteile darüber.', en: 'Men are disturbed not by the things which happen, but by the opinions about the things.', author: 'Epictetus' },
	{ de: 'Mache das Beste aus dem, was in deiner Macht liegt, und nimm den Rest, wie er kommt.', en: 'Make the best use of what is in your power, and take the rest as it happens.', author: 'Epictetus' },

	// Ralph Waldo Emerson
	{ de: 'Schreibe es in dein Herz: Jeder Tag ist der beste Tag des Jahres.', en: 'Write it on your heart that every day is the best day in the year.', author: 'Ralph Waldo Emerson' },

	// Joseph Campbell
	{ de: 'Die Höhle, vor der du Angst hast einzutreten, birgt den Schatz, den du suchst.', en: 'The cave you fear to enter holds the treasure you seek.', author: 'Joseph Campbell' },
];

export function getRandomQuote(lang: 'de' | 'en'): { text: string; author: string } {
	let lastIdx = -1;
	if (typeof localStorage !== 'undefined') {
		lastIdx = parseInt(localStorage.getItem(STORAGE_KEY) ?? '-1');
	}

	let idx: number;
	do {
		idx = Math.floor(Math.random() * quotes.length);
	} while (idx === lastIdx && quotes.length > 1);

	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, String(idx));
	}

	const q = quotes[idx];
	return { text: lang === 'de' ? q.de : q.en, author: q.author };
}
