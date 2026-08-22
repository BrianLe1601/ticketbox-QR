import { Music, Monitor, Utensils, Dumbbell, Palette, TrendingUp } from "lucide-react";
import type { CategorySlug } from "@/types/event.types";

const ICON_MAP: Record<CategorySlug, React.ElementType> = {
    music: Music,
    conference: Monitor,
    food: Utensils,
    sports: Dumbbell,
    art: Palette,
};

export function CategoryIcon({ category, size = 14 }: { category: CategorySlug; size?: number }) {
    const Icon = ICON_MAP[category] ?? TrendingUp;
    return <Icon size={size} />;
}