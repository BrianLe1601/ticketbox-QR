import { Disc3, Guitar, Headphones, Mic, Music, Piano } from "lucide-react";
import type { CategorySlug } from "@/types/event.types";

// One icon per catalogue genre (slugs installed by the schema); anything else is a music note.
const ICON_MAP: Record<string, React.ElementType> = {
    rock: Guitar,
    metal: Guitar,
    indie: Guitar,
    acoustic: Guitar,
    "folk-dong-que": Guitar,
    "rap-hip-hop": Mic,
    "rnb-soul": Mic,
    ballad: Mic,
    "bolero-nhac-vang": Mic,
    edm: Headphones,
    "latin-reggae": Disc3,
    "kpop-jpop": Disc3,
    jazz: Piano,
    blues: Piano,
    "co-dien": Piano,
};

export function CategoryIcon({ category, size = 14 }: { category: CategorySlug; size?: number }) {
    const Icon = ICON_MAP[category] ?? Music;
    return <Icon size={size} />;
}
