import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Todo {
  id: string
  title: string
  completed: number
  sort_order: number
  created_at: number
  updated_at: number
}

const API = '/api'

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch(`${API}/todos`)
  const data = await res.json()
  return data.todos
}

async function createTodo(title: string): Promise<Todo> {
  const res = await fetch(`${API}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  const data = await res.json()
  return data.todo
}

async function updateTodo(id: string, body: { title?: string; completed?: number }): Promise<Todo> {
  const res = await fetch(`${API}/todos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return data.todo
}

async function reorderTodos(ids: string[]): Promise<void> {
  await fetch(`${API}/todos/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
}

async function archiveCompleted(): Promise<number> {
  const res = await fetch(`${API}/todos/archive-completed`, { method: 'POST' })
  const data = await res.json()
  return data.archived
}

async function deleteTodo(id: string): Promise<void> {
  await fetch(`${API}/todos/${id}`, { method: 'DELETE' })
}

function SortableItem({
  todo,
  compact,
  onToggle,
  onDelete,
  onEdit,
}: {
  todo: Todo
  compact: boolean
  onToggle: (id: string, completed: number) => void
  onDelete: (id: string) => void
  onEdit: (id: string, title: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(todo.title)
  const editRef = useRef<HTMLInputElement>(null)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  })

  useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : todo.completed ? 0.45 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: compact ? '8px 10px' : '8px 12px',
    borderBottom: '1px solid var(--border)',
    cursor: 'default',
    position: 'relative',
  }

  const checkSize = compact ? 12 : 13
  const fontSize = 12

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Checkbox */}
      <div
        onClick={() => onToggle(todo.id, todo.completed ? 0 : 1)}
        style={{
          width: checkSize,
          height: checkSize,
          borderRadius: '50%',
          border: todo.completed ? 'none' : '1.5px solid var(--accent)',
          background: todo.completed ? 'var(--accent)' : 'transparent',
          flexShrink: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {todo.completed ? (
          <span style={{ color: 'var(--bg)', fontSize: compact ? 8 : 9, fontWeight: 'bold' }}>✓</span>
        ) : null}
      </div>

      {/* Title */}
      {editing ? (
        <input
          ref={editRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              const v = editValue.trim()
              if (v && v !== todo.title) onEdit(todo.id, v)
              setEditing(false)
            }
            if (e.key === 'Escape') {
              setEditValue(todo.title)
              setEditing(false)
            }
          }}
          onBlur={() => {
            const v = editValue.trim()
            if (v && v !== todo.title) onEdit(todo.id, v)
            setEditing(false)
          }}
          style={{
            flex: 1,
            fontSize,
            color: 'var(--text-1)',
            background: 'var(--surface2)',
            border: '1px solid var(--accent)',
            borderRadius: 3,
            outline: 'none',
            padding: '1px 4px',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span
          onDoubleClick={() => {
            setEditValue(todo.title)
            setEditing(true)
          }}
          style={{
            flex: 1,
            fontSize,
            color: todo.completed ? 'var(--text-2)' : 'var(--text-1)',
            textDecoration: todo.completed ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'text',
          }}
        >
          {todo.title}
        </span>
      )}

      {/* Delete button (hover) */}
      {hovered && (
        <span
          onClick={() => onDelete(todo.id)}
          style={{
            color: 'var(--text-3)',
            fontSize: 14,
            cursor: 'pointer',
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </span>
      )}

      {/* Drag handle */}
      {!compact && (
        <span
          {...attributes}
          {...listeners}
          style={{
            color: hovered ? 'var(--text-2)' : 'var(--text-3)',
            fontSize: 10,
            cursor: 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          ⠿
        </span>
      )}
    </div>
  )
}

export function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')
  const [compact, setCompact] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const load = useCallback(async () => {
    const data = await fetchTodos()
    setTodos(data)
  }, [])

  useEffect(() => { load() }, [load])

  // ResizeObserver for compact mode
  useEffect(() => {
    if (!rootRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      setCompact(w < 200)
    })
    ro.observe(rootRef.current)
    return () => ro.disconnect()
  }, [])

  async function handleAdd() {
    const title = input.trim()
    if (!title) return
    const todo = await createTodo(title)
    setTodos(prev => [...prev, todo])
    setInput('')
    inputRef.current?.focus()
  }

  async function handleToggle(id: string, completed: number) {
    const updated = await updateTodo(id, { completed })
    setTodos(prev => prev.map(t => (t.id === id ? updated : t)))
  }

  async function handleEdit(id: string, title: string) {
    const updated = await updateTodo(id, { title })
    setTodos(prev => prev.map(t => (t.id === id ? updated : t)))
  }

  async function handleDelete(id: string) {
    await deleteTodo(id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  async function handleArchive() {
    await archiveCompleted()
    await load()
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = todos.findIndex(t => t.id === active.id)
    const newIndex = todos.findIndex(t => t.id === over.id)
    const reordered = arrayMove(todos, oldIndex, newIndex)
    setTodos(reordered)
    await reorderTodos(reordered.map(t => t.id))
  }

  const hasCompleted = todos.some(t => t.completed)

  return (
    <div
      ref={rootRef}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {todos.map(todo => (
              <SortableItem
                key={todo.id}
                todo={todo}
                compact={compact}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Bottom bar: input + archive */}
      <div
        style={{
          marginTop: 0,
          padding: compact ? '6px 10px' : '8px 12px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) handleAdd() }}
          placeholder={compact ? '+ Add...' : '+ Add todo...'}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-2)',
            fontSize: compact ? 11 : 12,
            fontFamily: 'inherit',
          }}
        />
        {hasCompleted && !compact && (
          <span
            onClick={handleArchive}
            style={{
              color: 'var(--text-3)',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          >
            归档 ✓
          </span>
        )}
      </div>
    </div>
  )
}
