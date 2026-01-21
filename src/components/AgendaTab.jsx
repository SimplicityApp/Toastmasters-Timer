import { useState } from 'react';
import { useTimer } from '../context/TimerContext';
import { Plus, Upload, X, Edit2, Trash2, GripVertical, Check } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ROLE_OPTIONS } from '../constants/timingRules';

function SortableItem({ item, isActive, isCompleted, onEdit, onDelete, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 border-b border-gray-200 cursor-pointer
        transition-colors
        ${isActive ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}
      `}
    >
      {isCompleted ? (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
          <Check className="h-4 w-4 text-white" />
        </div>
      ) : (
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="h-5 w-5" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900">{item.name}</div>
        <div className="text-sm text-gray-500">({item.role})</div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function AgendaTab() {
  const {
    agenda,
    activeSpeakerId,
    addToAgenda,
    removeFromAgenda,
    reorderAgenda,
    loadSpeakerFromAgenda,
    importBulkSpeakers,
    roleRules,
  } = useTimer();

  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [newSpeakerRole, setNewSpeakerRole] = useState('Standard Speech');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = agenda.findIndex((item) => item.id === active.id);
      const newIndex = agenda.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(agenda, oldIndex, newIndex);
      reorderAgenda(newOrder);
    }
  };

  const handleImport = () => {
    if (importText.trim()) {
      const count = importBulkSpeakers(importText);
      alert(`Imported ${count} speaker(s)`);
      setImportText('');
      setShowImportModal(false);
    }
  };

  const handleAdd = () => {
    if (newSpeakerName.trim()) {
      addToAgenda({
        name: newSpeakerName.trim(),
        role: newSpeakerRole,
      });
      setNewSpeakerName('');
      setNewSpeakerRole('Standard Speech');
      setShowAddModal(false);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setNewSpeakerName(item.name);
    setNewSpeakerRole(item.role);
    setShowAddModal(true);
  };

  const handleUpdate = () => {
    if (editItem && newSpeakerName.trim()) {
      // Remove old item and add updated one
      removeFromAgenda(editItem.id);
      addToAgenda({
        name: newSpeakerName.trim(),
        role: newSpeakerRole,
      });
      setEditItem(null);
      setNewSpeakerName('');
      setNewSpeakerRole('Standard Speech');
      setShowAddModal(false);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to remove this speaker from the agenda?')) {
      removeFromAgenda(id);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setShowImportModal(true)}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Import Text
        </button>
        <button
          onClick={() => {
            setEditItem(null);
            setNewSpeakerName('');
            setNewSpeakerRole('Standard Speech');
            setShowAddModal(true);
          }}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      {agenda.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No speakers in agenda. Add speakers or import from text.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={agenda.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {agenda.map((item, index) => (
                <SortableItem
                  key={item.id}
                  item={{ ...item, index: index + 1 }}
                  isActive={activeSpeakerId === item.id}
                  isCompleted={item.completed}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onClick={() => loadSpeakerFromAgenda(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Import Speakers</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Enter one speaker per line. Roles will be auto-detected from text (e.g., "Ice Breaker", "Table Topics").
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="John Doe (Ice Breaker)&#10;Sarah Smith (Standard Speech)&#10;Alex (Table Topics)"
              className="w-full h-32 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleImport}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Import
              </button>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editItem ? 'Edit Speaker' : 'Add Speaker'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditItem(null);
                  setNewSpeakerName('');
                  setNewSpeakerRole('Standard Speech');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Speaker Name
                </label>
                <input
                  type="text"
                  value={newSpeakerName}
                  onChange={(e) => setNewSpeakerName(e.target.value)}
                  placeholder="Enter speaker name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={newSpeakerRole}
                  onChange={(e) => setNewSpeakerRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={editItem ? handleUpdate : handleAdd}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {editItem ? 'Update' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditItem(null);
                  setNewSpeakerName('');
                  setNewSpeakerRole('Standard Speech');
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
