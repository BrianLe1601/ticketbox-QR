import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, CalendarDays, GripVertical, Power } from "lucide-react";

import { ActionMenu, ButtonLink, StatusBadge, Switch } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { AdminCategory } from "@/services/admin-categories.service";

export interface CategoryHandlers {
  toggle: (item: AdminCategory) => void;
  move: (item: AdminCategory, offset: -1 | 1) => void;
  reorder: (fromId: number, toId: number) => void;
}

function EventsLink({ item }: { item: AdminCategory }) {
  return item.eventCount > 0
    ? <ButtonLink to={`/admin/events?category=${item.slug}`} size="sm" variant="ghost" icon={CalendarDays}>{item.eventCount} sự kiện</ButtonLink>
    : <span className="cat-none">Chưa có sự kiện</span>;
}

function Row({ item, position, total, reorderable, busy, handlers }: {
  item: AdminCategory; position: number; total: number; reorderable: boolean; busy: boolean; handlers: CategoryHandlers;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !reorderable || busy });
  const style = { transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined, transition };
  return (
    <li ref={setNodeRef} style={style} className={cn("cat-row", !item.isActive && "is-off", isDragging && "is-dragging")}>
      {reorderable ? (
        <button ref={setActivatorNodeRef} type="button" className="cat-grip" disabled={busy} aria-label={`Kéo để đổi thứ tự ${item.name} (đang ở vị trí ${position})`} {...attributes} {...listeners}>
          <GripVertical size={16} aria-hidden="true" />
        </button>
      ) : <span className="cat-grip is-off" aria-hidden="true" />}
      <span className="cat-pos tb-num" aria-hidden="true">{position}</span>
      <span className="cat-main">
        <span className="cat-name"><strong>{item.name}</strong></span>
        {item.description && <span className="cat-desc">{item.description}</span>}
      </span>
      <span className="cat-events"><EventsLink item={item} /></span>
      <span className="cat-actions">
        <Switch className="cat-switch" checked={item.isActive} disabled={busy} onCheckedChange={() => handlers.toggle(item)}
          label={<span className="sr-only">{item.name}</span>} stateLabels={["Đã tắt", "Đang bật"]} />
        {reorderable && (
          <ActionMenu
            label={`Thao tác khác cho ${item.name}`}
            actions={[
              { label: "Lên một bậc", icon: ArrowUp, onSelect: () => handlers.move(item, -1), disabled: position === 1 || busy, disabledReason: position === 1 ? "Đang ở đầu danh sách" : undefined },
              { label: "Xuống một bậc", icon: ArrowDown, onSelect: () => handlers.move(item, 1), disabled: position === total || busy, disabledReason: position === total ? "Đang ở cuối danh sách" : undefined },
            ]}
          />
        )}
      </span>
    </li>
  );
}

/**
 * Catalogue genres in public display order. Dragging (pointer or keyboard) reorders; it is only
 * offered on the complete, unfiltered list so positions mean the real public order.
 */
export function CategoryList({ items, reorderable, busy, handlers }: { items: AdminCategory[]; reorderable: boolean; busy: boolean; handlers: CategoryHandlers }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const nameOf = (id: string | number) => items.find((item) => item.id === Number(id))?.name ?? "thể loại";
  const positionOf = (id: string | number | undefined) => items.findIndex((item) => item.id === Number(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Đã nhấc ${nameOf(active.id)} ở vị trí ${positionOf(active.id)}. Mũi tên lên/xuống để di chuyển, Space để thả, Esc để hủy.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} sẽ ở vị trí ${positionOf(over.id)}.` : `${nameOf(active.id)} ở ngoài danh sách.`),
    onDragEnd: ({ active, over }) => (over ? `Đã thả ${nameOf(active.id)} vào vị trí ${positionOf(over.id)}.` : `Đã thả ${nameOf(active.id)}.`),
    onDragCancel: ({ active }) => `Đã hủy, ${nameOf(active.id)} giữ nguyên vị trí.`,
  };
  function onDragEnd(event: DragEndEvent) {
    if (event.over && event.active.id !== event.over.id) handlers.reorder(Number(event.active.id), Number(event.over.id));
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: "Nhấn Space để nhấc, mũi tên lên/xuống để di chuyển, Space để thả, Esc để hủy. Menu ⋯ có Lên/Xuống một bậc." } }}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ol className="cat-list" aria-label="Thể loại nhạc theo thứ tự hiển thị">
          {items.map((item, index) => <Row key={item.id} item={item} position={index + 1} total={items.length} reorderable={reorderable} busy={busy} handlers={handlers} />)}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

/** Legacy Categories: read-only history; the only action is switching one off. */
export function LegacyCategoryList({ items, busy, onTurnOff }: { items: AdminCategory[]; busy: boolean; onTurnOff: (item: AdminCategory) => void }) {
  return (
    <ul className="cat-list cat-legacy" aria-label="Danh mục cũ">
      {items.map((item) => (
        <li key={item.id} className={cn("cat-row is-legacy", !item.isActive && "is-off")}>
          <span className="cat-main">
            <span className="cat-name"><strong>{item.name}</strong></span>
            <span className="cat-badges">
              <StatusBadge label={item.isActive ? "Còn hiện với khách" : "Đã tắt"} tone={item.isActive ? "warning" : "neutral"} size="sm" />
            </span>
          </span>
          <span className="cat-events"><EventsLink item={item} /></span>
          <span className="cat-actions">
            {item.isActive && (
              <ActionMenu label={`Thao tác cho ${item.name}`}
                actions={[{ label: "Tắt danh mục cũ", icon: Power, onSelect: () => onTurnOff(item), disabled: busy }]} />
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
