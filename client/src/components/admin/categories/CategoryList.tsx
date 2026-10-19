import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, CalendarDays, Edit3, GripVertical, Lock, Power, Trash2 } from "lucide-react";

import { ActionMenu, ButtonLink, IconButton, StatusBadge } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { AdminCategory } from "@/services/admin-categories.service";

export interface CategoryHandlers {
  edit: (item: AdminCategory) => void;
  toggle: (item: AdminCategory) => void;
  remove: (item: AdminCategory) => void;
  move: (item: AdminCategory, offset: -1 | 1) => void;
  reorder: (fromId: number, toId: number) => void;
}

function Row({ item, position, total, reorderable, busy, handlers }: {
  item: AdminCategory; position: number; total: number; reorderable: boolean; busy: boolean; handlers: CategoryHandlers;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !reorderable || busy });
  const style = { transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined, transition };
  const locked = item.eventCount > 0;
  return (
    <li ref={setNodeRef} style={style} className={cn("cat-row", !item.isActive && "is-off", isDragging && "is-dragging")}>
      {reorderable ? (
        <button ref={setActivatorNodeRef} type="button" className="cat-grip" disabled={busy} aria-label={`Kéo để đổi thứ tự ${item.name} (đang ở vị trí ${position})`} {...attributes} {...listeners}>
          <GripVertical size={16} aria-hidden="true" />
        </button>
      ) : <span className="cat-grip is-off" aria-hidden="true" />}
      <span className="cat-pos tb-num" aria-hidden="true">{position}</span>
      <span className="cat-main">
        <span className="cat-name">
          <strong>{item.name}</strong>
          <span className="cat-slug">/{item.slug}{locked && <Lock size={12} aria-label="Đường dẫn đã khóa vì có sự kiện" />}</span>
        </span>
        {item.description && <span className="cat-desc">{item.description}</span>}
        <span className="cat-badges">
          <StatusBadge label={item.kind === "music" ? "Thể loại âm nhạc" : "Khác (danh mục cũ)"} tone={item.kind === "music" ? "primary" : "neutral"} size="sm" />
          <StatusBadge domain="category" status={item.isActive ? "active" : "inactive"} size="sm" />
          <span className={cn("cat-select", item.selectableForNewEvent ? "is-yes" : "is-no")}>
            {item.selectableForNewEvent ? "Chọn được cho sự kiện mới" : item.isActive ? "Ngoài phạm vi sự kiện mới" : "Không chọn được"}
          </span>
        </span>
      </span>
      <span className="cat-events">
        {item.eventCount > 0
          ? <ButtonLink to={`/admin/events?category=${item.slug}`} size="sm" variant="ghost" icon={CalendarDays}>{item.eventCount} sự kiện</ButtonLink>
          : <span className="cat-none">Chưa có sự kiện</span>}
      </span>
      <span className="cat-actions">
        <IconButton size="sm" variant="secondary" icon={Edit3} label={`Sửa ${item.name}`} disabled={busy} onClick={() => handlers.edit(item)} />
        <ActionMenu
          label={`Thao tác khác cho ${item.name}`}
          actions={[
            ...(reorderable ? [
              { label: "Lên một bậc", icon: ArrowUp, onSelect: () => handlers.move(item, -1), disabled: position === 1 || busy, disabledReason: position === 1 ? "Đang ở đầu danh sách" : undefined },
              { label: "Xuống một bậc", icon: ArrowDown, onSelect: () => handlers.move(item, 1), disabled: position === total || busy, disabledReason: position === total ? "Đang ở cuối danh sách" : undefined },
            ] : []),
            { label: item.isActive ? "Vô hiệu hóa" : "Kích hoạt lại", icon: Power, onSelect: () => handlers.toggle(item), disabled: busy },
            { label: "Xóa danh mục", icon: Trash2, tone: "danger" as const, onSelect: () => handlers.remove(item), disabled: locked || busy, disabledReason: locked ? `Có ${item.eventCount} sự kiện: chỉ vô hiệu hóa được` : undefined },
          ]}
        />
      </span>
    </li>
  );
}

/**
 * Categories in public display order. Dragging (pointer or keyboard) reorders; it is only offered
 * on the complete, unfiltered list so positions mean the real public order.
 */
export function CategoryList({ items, reorderable, busy, handlers }: { items: AdminCategory[]; reorderable: boolean; busy: boolean; handlers: CategoryHandlers }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const nameOf = (id: string | number) => items.find((item) => item.id === Number(id))?.name ?? "danh mục";
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
        <ol className="cat-list" aria-label="Danh mục theo thứ tự hiển thị">
          {items.map((item, index) => <Row key={item.id} item={item} position={index + 1} total={items.length} reorderable={reorderable} busy={busy} handlers={handlers} />)}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
