import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import { GripVertical, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAmount } from '@/utils';

export default function AccountsList({ accounts, editMode, onReorder, onEdit, onDelete, onSelect, getAccountBalance }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    onReorder(result.source.index, result.destination.index);
  };

  if (editMode) {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="accounts">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {accounts.map((account, index) => {
                const balance = getAccountBalance(account.id);
                
                return (
                  <Draggable key={account.id} draggableId={account.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={provided.draggableProps.style}
                        className={`bg-white rounded-2xl p-4 border border-slate-100 ${
                          snapshot.isDragging ? 'shadow-lg' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-5 h-5 text-slate-400" />
                            </div>
                            <div 
                              className="p-3 rounded-xl"
                              style={{ backgroundColor: account.color + '20' }}
                            >
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: account.color }} />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900">{account.name}</h3>
                              <p className="text-xs text-slate-500 capitalize">{account.category.replace('_', ' ')}</p>
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(account)}
                            className="text-blue-600"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete?.(account)}
                            className="text-red-500 hover:text-red-600"
                            aria-label={`Delete ${account.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account, index) => {
        const balance = getAccountBalance(account.id);
        
        return (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(account.id)}
            className="bg-white rounded-2xl p-4 border border-slate-100 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div 
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: account.color + '20' }}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: account.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{account.name}</h3>
                  <p className="text-xs text-slate-500 capitalize">{account.category.replace('_', ' ')}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900 tabular-nums">
                    €{formatAmount(balance)}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
