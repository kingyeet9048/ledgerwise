import React, { useEffect, useState } from 'react'
import { PlanNote, PlanNoteCategory } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import PlanNoteForm from '../components/forms/PlanNoteForm'
import { Plus, Edit2, Trash2, BookOpen } from 'lucide-react'
import { format } from 'date-fns'

const CATEGORY_COLORS: Record<PlanNoteCategory, string> = {
  general: 'bg-surface-700 text-surface-300',
  goal_change: 'bg-primary-900/40 text-primary-400',
  allocation_change: 'bg-purple-900/40 text-purple-400',
  debt_plan: 'bg-red-900/40 text-red-400',
  projection: 'bg-green-900/40 text-green-400'
}

const CATEGORY_LABELS: Record<PlanNoteCategory, string> = {
  general: 'General',
  goal_change: 'Goal Change',
  allocation_change: 'Allocation Change',
  debt_plan: 'Debt Plan',
  projection: 'Projection'
}

export default function PlanNotesPage(): React.ReactElement {
  const [notes, setNotes] = useState<PlanNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editNote, setEditNote] = useState<PlanNote | undefined>()
  const [deleteNote, setDeleteNote] = useState<PlanNote | undefined>()
  const { addToast } = useAppStore()

  useEffect(() => {
    loadNotes()
  }, [])

  async function loadNotes(): Promise<void> {
    setLoading(true)
    const res = await window.api.planNotes.list()
    if (res.success && res.data) setNotes(res.data)
    setLoading(false)
  }

  async function handleDelete(): Promise<void> {
    if (!deleteNote) return
    const res = await window.api.planNotes.delete(deleteNote.id)
    if (res.success) {
      addToast('Note deleted', 'success')
      loadNotes()
    } else {
      addToast(res.error || 'Failed to delete note', 'error')
    }
    setDeleteNote(undefined)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <h1 className="page-title">Plan Notes</h1>
        <button
          onClick={() => { setEditNote(undefined); setShowForm(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      </div>

      <p className="text-surface-400 text-sm -mt-4">
        Document financial decisions and reasoning for your future self.
      </p>

      {loading ? (
        <div className="text-center py-12 text-surface-500">Loading notes...</div>
      ) : notes.length > 0 ? (
        <div className="flex flex-col gap-0">
          {notes.map((note, idx) => (
            <div key={note.id} className="flex gap-4">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                {idx < notes.length - 1 && (
                  <div className="w-0.5 bg-surface-700 flex-1 mt-1" style={{ minHeight: '2rem' }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-surface-500 text-xs">
                        {format(new Date(note.effective_date), 'MMM d, yyyy')}
                      </span>
                      {note.category && (
                        <span className={`badge ${CATEGORY_COLORS[note.category as PlanNoteCategory]}`}>
                          {CATEGORY_LABELS[note.category as PlanNoteCategory]}
                        </span>
                      )}
                    </div>
                    <h3 className="text-surface-100 font-semibold mb-2">{note.title}</h3>
                    <div className="card border-surface-600 p-4">
                      <p className="text-surface-300 text-sm leading-relaxed whitespace-pre-wrap">{note.body}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditNote(note); setShowForm(true) }}
                      className="p-1.5 text-surface-500 hover:text-primary-400 hover:bg-surface-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteNote(note)}
                      className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-surface-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <BookOpen className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <div className="text-surface-400 font-medium mb-1">No plan notes yet</div>
          <p className="text-surface-600 text-sm mb-4">
            Start documenting your financial decisions and the reasoning behind them.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Note
          </button>
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditNote(undefined) }}
        title={editNote ? 'Edit Note' : 'Add Plan Note'}
        size="lg"
      >
        <PlanNoteForm
          note={editNote}
          onSuccess={() => { setShowForm(false); setEditNote(undefined); loadNotes() }}
          onCancel={() => { setShowForm(false); setEditNote(undefined) }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteNote}
        onClose={() => setDeleteNote(undefined)}
        onConfirm={handleDelete}
        title="Delete Note"
        message={`Delete "${deleteNote?.title}"?`}
        confirmLabel="Delete"
        isDestructive
      />
    </div>
  )
}
