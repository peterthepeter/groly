<script lang="ts">
	import {
		Trophy, PersonStanding, Bike, MountainSnow, Mountain, Flower2, Waves, Dumbbell, Map, Activity,
		BookOpen, Music, Gamepad2, Film, Tv, Palette, Paintbrush, ChefHat, Camera, Footprints,
		Shovel, Utensils, ShoppingBag, Ticket, Hammer,
		Smile, Sun, Zap, Heart, Award, Moon, Sprout, Cloud, CloudRain, AlertCircle,
		Frown, Flame, Gauge, BatteryLow, Meh, CircleMinus, Timer,
		Users, Home, House, PartyPopper, Coffee, Sofa,
		CloudMoon, Salad, Stethoscope, Thermometer, Leaf,
		Briefcase, CircleCheck, AlarmClock, Plane, Bed,
		ThermometerSun, Snowflake, Pill
	} from 'lucide-svelte';

	const ICON_MAP: Record<string, any> = {
		trophy: Trophy,
		'person-standing': PersonStanding,
		bike: Bike,
		'mountain-snow': MountainSnow,
		mountain: Mountain,
		'flower-2': Flower2,
		waves: Waves,
		dumbbell: Dumbbell,
		map: Map,
		activity: Activity,
		'book-open': BookOpen,
		music: Music,
		'gamepad-2': Gamepad2,
		film: Film,
		tv: Tv,
		palette: Palette,
		paintbrush: Paintbrush,
		'chef-hat': ChefHat,
		camera: Camera,
		footprints: Footprints,
		shovel: Shovel,
		utensils: Utensils,
		'shopping-bag': ShoppingBag,
		ticket: Ticket,
		hammer: Hammer,
		smile: Smile,
		sun: Sun,
		zap: Zap,
		heart: Heart,
		award: Award,
		moon: Moon,
		sprout: Sprout,
		cloud: Cloud,
		'cloud-rain': CloudRain,
		'alert-circle': AlertCircle,
		frown: Frown,
		flame: Flame,
		gauge: Gauge,
		'battery-low': BatteryLow,
		meh: Meh,
		'circle-minus': CircleMinus,
		timer: Timer,
		users: Users,
		home: Home,
		house: House,
		'party-popper': PartyPopper,
		coffee: Coffee,
		sofa: Sofa,
		'cloud-moon': CloudMoon,
		salad: Salad,
		stethoscope: Stethoscope,
		thermometer: Thermometer,
		leaf: Leaf,
		briefcase: Briefcase,
		'circle-check': CircleCheck,
		'alarm-clock': AlarmClock,
		plane: Plane,
		bed: Bed,
		'thermometer-sun': ThermometerSun,
		snowflake: Snowflake,
		pill: Pill
	};

	let { icon, size = 18, color = 'var(--color-primary)' }: { icon: string; size?: number; color?: string } = $props();
</script>

{#if ICON_MAP[icon]}
	{@const Component = ICON_MAP[icon]}
	<Component {size} stroke={color} strokeWidth={1.7} />
{/if}
