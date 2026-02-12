import { useState } from 'react';
import { useTimer } from '../context/TimerContext';
import { useToast } from '../context/ToastContext';
import { Plus, Upload, X, Edit2, Trash2, GripVertical, Check } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { trackEvent } from '../utils/posthog';
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
import { DEFAULT_ROLE_RULES, DEFAULT_CUSTOM_RULES } from '../constants/timingRules';

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
        <div className="text-sm text-gray-500">
          ({item.role}
          {item.role === 'Short Roles' && item.originalShortRole && (
            <span className="ml-1 text-gray-400">- {item.originalShortRole}</span>
          )}
          )
        </div>
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

export default function AgendaTab({ onSwitchToLive }) {
  const {
    agenda,
    activeSpeakerId,
    addToAgenda,
    removeFromAgenda,
    reorderAgenda,
    loadSpeakerFromAgenda,
    importBulkSpeakers,
    importEasySpeakSpeakers,
    clearAllAgenda,
    roleRules,
    roleOptions,
  } = useTimer();
  const { showToast } = useToast();

  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [importTab, setImportTab] = useState('easyspeak'); // 'simple' | 'easyspeak'
  const [importText, setImportText] = useState('');
  const [easySpeakText, setEasySpeakText] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [newSpeakerRole, setNewSpeakerRole] = useState('Standard Speech');
  const [customRules, setCustomRules] = useState({ ...DEFAULT_CUSTOM_RULES });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

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
      
      // Track agenda reordered
      const movedItem = agenda[oldIndex];
      trackEvent('agenda_reordered', {
        speaker_name: movedItem?.name || 'Unnamed',
        old_index: oldIndex,
        new_index: newIndex
      });
    }
  };

  const handleSimpleImport = () => {
    if (importText.trim()) {
      const count = importBulkSpeakers(importText);
      showToast(`Imported ${count} speaker(s)`, 'success');
      setImportText('');
      setShowImportModal(false);
    }
  };

  const handleEasySpeakImport = () => {
    if (easySpeakText.trim()) {
      const count = importEasySpeakSpeakers(easySpeakText);
      showToast(`Imported ${count} speaker(s)`, 'success');
      setEasySpeakText('');
      setShowImportModal(false);
    }
  };

  const handleAdd = () => {
    if (newSpeakerName.trim()) {
      const speakerData = {
        name: newSpeakerName.trim(),
        role: newSpeakerRole,
      };
      // If Custom role, include custom rules
      if (newSpeakerRole === 'Custom') {
        speakerData.rules = customRules;
      }
      addToAgenda(speakerData);
      setNewSpeakerName('');
      setNewSpeakerRole('Standard Speech');
      setCustomRules({ ...DEFAULT_CUSTOM_RULES });
      setShowAddModal(false);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setNewSpeakerName(item.name);
    setNewSpeakerRole(item.role);
    // If item has custom rules, load them (merge so missing graceAfterRed is filled)
    if (item.role === 'Custom' && item.rules) {
      setCustomRules({ ...DEFAULT_CUSTOM_RULES, ...item.rules });
    } else {
      setCustomRules({ ...DEFAULT_CUSTOM_RULES });
    }
    setShowAddModal(true);
  };

  const handleUpdate = () => {
    if (editItem && newSpeakerName.trim()) {
      // Remove old item and add updated one
      removeFromAgenda(editItem.id);
      const speakerData = {
        name: newSpeakerName.trim(),
        role: newSpeakerRole,
      };
      // If Custom role, include custom rules
      if (newSpeakerRole === 'Custom') {
        speakerData.rules = customRules;
      }
      addToAgenda(speakerData);
      setEditItem(null);
      setNewSpeakerName('');
      setNewSpeakerRole('Standard Speech');
      setCustomRules({ ...DEFAULT_CUSTOM_RULES });
      setShowAddModal(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteItemId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteItemId) {
      removeFromAgenda(deleteItemId);
    }
    setShowDeleteConfirm(false);
    setDeleteItemId(null);
  };

  const handleClearAll = () => {
    setShowClearAllConfirm(true);
  };

  const handleConfirmClearAll = () => {
    clearAllAgenda();
    setShowClearAllConfirm(false);
  };

  // Helper to format seconds as MM:SS for display
  const formatTimeForInput = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Helper to format seconds as readable time
  const formatTimeReadable = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) {
      return `${secs} second${secs !== 1 ? 's' : ''}`;
    }
    if (secs === 0) {
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    }
    return `${mins} min ${secs} sec`;
  };

  // Get explanation text for each role
  const getRoleExplanation = (role) => {
    const rules = roleRules[role] || DEFAULT_ROLE_RULES[role] || DEFAULT_ROLE_RULES['Standard Speech'];
    return `Green: ${formatTimeReadable(rules.green)}, Yellow: ${formatTimeReadable(rules.yellow)}, Red: ${formatTimeReadable(rules.red)}`;
  };

  const handleCustomRuleChange = (field, value) => {
    const numValue =
      field === 'graceAfterRed'
        ? Math.max(0, parseInt(value, 10) || 0)
        : (parseInt(value, 10) || 0);
    setCustomRules(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSpeakerClick = (item) => {
    loadSpeakerFromAgenda(item.id);
    // Track speaker loaded from agenda
    trackEvent('speaker_loaded_from_agenda', {
      speaker_name: item.name || 'Unnamed',
      role: item.role
    });
    if (onSwitchToLive) {
      onSwitchToLive();
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => {
            setImportTab('easyspeak');
            setImportText('');
            setEasySpeakText('');
            setShowImportModal(true);
          }}
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
            setCustomRules({ ...DEFAULT_CUSTOM_RULES });
            setShowAddModal(true);
          }}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
        {agenda.length > 0 && (
          <button
            onClick={handleClearAll}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </button>
        )}
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
                  onClick={() => handleSpeakerClick(item)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Import Speakers</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
                  setEasySpeakText('');
                  setImportTab('easyspeak');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                onClick={() => setImportTab('easyspeak')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  importTab === 'easyspeak'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                EasySpeak Format
              </button>
              <button
                onClick={() => setImportTab('simple')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  importTab === 'simple'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Simple Format
              </button>
            </div>

            {/* Tab Content */}
            {importTab === 'easyspeak' ? (
              <div>
                <div className="mb-3 space-y-2">
                  <p className="text-sm text-gray-700 font-medium">
                    EasySpeak Format
                  </p>
                  <p className="text-sm text-gray-600">
                    Paste meeting details from EasySpeak website. Supports both "show speech details" and "hide speech details" modes.
                  </p>
                  <p className="text-xs text-gray-500">
                    Roles will be automatically detected and mapped to timing rules.
                  </p>
                </div>
                <textarea
                  value={easySpeakText}
                  onChange={(e) => setEasySpeakText(e.target.value)}
                  placeholder="Paste EasySpeak meeting details here..."
                  className="w-full h-64 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleEasySpeakImport}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Import
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportText('');
                      setEasySpeakText('');
                      setImportTab('easyspeak');
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3 space-y-2">
                  <p className="text-sm text-gray-700 font-medium">
                    Simple Format
                  </p>
                  <p className="text-sm text-gray-600">
                    Enter one speaker per line with role in parentheses. Roles will be auto-detected from text.
                  </p>
                  <p className="text-xs text-gray-500">
                    Example: "John Doe (Ice Breaker)" or "Sarah Smith (Standard Speech)"
                  </p>
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="John Doe (Ice Breaker)&#10;Sarah Smith (Standard Speech)&#10;Alex (Table Topics)"
                  className="w-full h-64 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSimpleImport}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Import
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportText('');
                      setEasySpeakText('');
                      setImportTab('easyspeak');
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
                  setCustomRules({ ...DEFAULT_CUSTOM_RULES });
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
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                {newSpeakerRole !== 'Custom' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Timing rules: {getRoleExplanation(newSpeakerRole)}
                  </p>
                )}
              </div>
              {newSpeakerRole === 'Custom' && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Custom Timing Rules</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Green (seconds)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={customRules.green}
                        onChange={(e) => handleCustomRuleChange('green', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder={String(DEFAULT_CUSTOM_RULES.green)}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimeForInput(customRules.green)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Yellow (seconds)
                      </label>
                      <input
                        type="number"
                        min={customRules.green + 1}
                        value={customRules.yellow}
                        onChange={(e) => handleCustomRuleChange('yellow', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder={String(DEFAULT_CUSTOM_RULES.yellow)}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimeForInput(customRules.yellow)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Red (seconds)
                      </label>
                      <input
                        type="number"
                        min={customRules.yellow + 1}
                        value={customRules.red}
                        onChange={(e) => handleCustomRuleChange('red', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder={String(DEFAULT_CUSTOM_RULES.red)}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimeForInput(customRules.red)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Grace (sec)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customRules.graceAfterRed ?? DEFAULT_CUSTOM_RULES.graceAfterRed}
                        onChange={(e) => handleCustomRuleChange('graceAfterRed', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder={String(DEFAULT_CUSTOM_RULES.graceAfterRed)}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        After red before DQ
                      </div>
                    </div>
                  </div>
                  {customRules.yellow <= customRules.green && (
                    <div className="text-xs text-red-600 mt-2">
                      Yellow must be greater than Green
                    </div>
                  )}
                  {customRules.red <= customRules.yellow && (
                    <div className="text-xs text-red-600 mt-2">
                      Red must be greater than Yellow
                    </div>
                  )}
                </div>
              )}
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
                  setCustomRules({ ...DEFAULT_CUSTOM_RULES });
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Remove Speaker"
        message="Are you sure you want to remove this speaker from the agenda?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteItemId(null);
        }}
      />

      {/* Clear All Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearAllConfirm}
        title="Clear All Agendas"
        message="Are you sure you want to clear all agendas? This action cannot be undone."
        confirmText="Clear All"
        cancelText="Cancel"
        onConfirm={handleConfirmClearAll}
        onCancel={() => setShowClearAllConfirm(false)}
      />
    </div>
  );
}
