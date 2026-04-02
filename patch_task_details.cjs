const fs = require('fs');
const path = './src/components/TaskDetails.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const startIndex = 367; // matches line 368
const endIndex = 1038;  // matches line 1039 (inclusive replacement)

const newLines = `    <div className="space-y-4 sm:space-y-6">
      <TaskHeader
        taskData={taskData}
        caseId={caseId}
        taskId={taskId}
        isEffectivelyClosed={isEffectivelyClosed}
        isTaskClosed={isTaskClosed}
        canEditTask={canEditTask}
        onBack={onBack}
        onEdit={() => setShowEditModal(true)}
        onClose={() => setShowCloseModal(true)}
        onDelete={handleDelete}
        onShare={handleShareTask}
        showCopiedMessage={showCopiedMessage}
        showStatusPicker={showStatusPicker}
        setShowStatusPicker={setShowStatusPicker}
        savingStatus={savingStatus}
        onSaveInitialStatus={handleSaveInitialStatus}
      />

      <TaskClosureDetails
        taskData={taskData}
        canEditTask={canEditTask}
        isClosed={isClosed}
        onEditClosureComment={() => {
          setEditClosureComment(taskData.closure_comment || '');
          setShowEditClosureComment(true);
        }}
        onReopenConfirm={() => setShowReopenConfirm(true)}
      />

      <div className="space-y-6">
        <TaskLinkedStixObject
          linkedStixObject={linkedStixObject}
          caseStixObjects={caseStixObjects}
          setEditingStixObject={setEditingStixObject}
        />

        <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">{t('auto.description')}</h3>
          <div
            className="text-gray-700 dark:text-slate-300 rich-text-content"
            dangerouslySetInnerHTML={{ __html: taskData.description }}
          />
        </div>

        {/* View mode switcher */}
        <div className="flex items-center justify-end gap-1 mb-2">
          {[
            { key: 'timeline', icon: List, label: 'Timeline' },
            { key: 'split', icon: Columns, label: 'Split' },
            { key: 'accordion', icon: LayoutList, label: 'Accordéon' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => changeViewMode(v.key as ViewMode)}
              title={v.label}
              className={\`p-1.5 rounded-lg transition \${viewMode === v.key
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
              }\`}
            >
              <v.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* ======================== VIEW A: TIMELINE ======================== */}
        {viewMode === 'timeline' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-blue-500 p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-white">Discussion</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{commentCount}</span>
              </div>
              <TaskParticipants participants={participants} />
              <TaskComments taskId={taskId} isClosed={isEffectivelyClosed} caseAuthorId={caseAuthorId} onCountChange={setCommentCount} isReadOnly={isReadOnly} />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-cyan-500 p-5">
              <TaskDiamondEvents
                taskDiamonds={taskDiamonds}
                caseKillChainType={caseKillChainType}
                canEditDiamond={canEditDiamond}
                onAddDiamond={() => { setEditingDiamond(null); setShowDiamondForm(true); }}
                onEditDiamond={startEditDiamond}
                onDeleteDiamond={handleDeleteDiamond}
              />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500 p-5">
              <StixObjectsList key={stixRefreshKey} taskId={taskId} caseId={caseId} isClosed={isEffectivelyClosed} />
            </div>
          </div>
        )}

        {/* ======================== VIEW B: SPLIT ======================== */}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-blue-500 p-5 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2.5 mb-4">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-white">Discussion</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{commentCount}</span>
              </div>
              <TaskParticipants participants={participants} />
              <TaskComments taskId={taskId} isClosed={isEffectivelyClosed} caseAuthorId={caseAuthorId} onCountChange={setCommentCount} isReadOnly={isReadOnly} />
            </div>

            <div className="lg:col-span-1 space-y-6 min-w-0 overflow-hidden">
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-cyan-500 p-5">
                <TaskDiamondEvents
                  taskDiamonds={taskDiamonds}
                  caseKillChainType={caseKillChainType}
                  canEditDiamond={canEditDiamond}
                  onAddDiamond={() => { setEditingDiamond(null); setShowDiamondForm(true); }}
                  onEditDiamond={startEditDiamond}
                  onDeleteDiamond={handleDeleteDiamond}
                />
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500 p-5">
                <StixObjectsList key={stixRefreshKey} taskId={taskId} caseId={caseId} isClosed={isEffectivelyClosed} />
              </div>
            </div>
          </div>
        )}

        {/* ======================== VIEW C: ACCORDION ======================== */}
        {viewMode === 'accordion' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-blue-500">
              <button onClick={() => toggleSection('discussion')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition rounded-t-lg">
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Discussion</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{commentCount}</span>
                </div>
                <ChevronDown className={\`w-4 h-4 text-gray-400 transition-transform duration-200 \${sectionOpen.discussion ? '' : '-rotate-90'}\`} />
              </button>
              {sectionOpen.discussion && (
                <div className="px-5 pb-5 pt-1">
                  <TaskParticipants participants={participants} />
                  <TaskComments taskId={taskId} isClosed={isEffectivelyClosed} caseAuthorId={caseAuthorId} onCountChange={setCommentCount} isReadOnly={isReadOnly} />
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-cyan-500">
              <button onClick={() => toggleSection('diamond')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition rounded-t-lg">
                <div className="flex items-center gap-2.5">
                  <Diamond className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Diamants</span>
                  {taskDiamonds.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">{taskDiamonds.length}</span>}
                </div>
                <ChevronDown className={\`w-4 h-4 text-gray-400 transition-transform duration-200 \${sectionOpen.diamond ? '' : '-rotate-90'}\`} />
              </button>
              {sectionOpen.diamond && (
                <div className="px-5 pb-5 pt-1">
                  <TaskDiamondEvents
                    taskDiamonds={taskDiamonds}
                    caseKillChainType={caseKillChainType}
                    canEditDiamond={canEditDiamond}
                    onAddDiamond={() => { setEditingDiamond(null); setShowDiamondForm(true); }}
                    onEditDiamond={startEditDiamond}
                    onDeleteDiamond={handleDeleteDiamond}
                  />
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500">
              <button onClick={() => toggleSection('objects')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition rounded-t-lg">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">{t('auto.elements_techniques', 'Éléments techniques')}</span>
                </div>
                <ChevronDown className={\`w-4 h-4 text-gray-400 transition-transform duration-200 \${sectionOpen.objects ? '' : '-rotate-90'}\`} />
              </button>
              {sectionOpen.objects && (
                <div className="px-5 pb-5 pt-1">
                  <StixObjectsList key={stixRefreshKey} taskId={taskId} caseId={caseId} isClosed={isEffectivelyClosed} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>`.split('\n');

const updatedLines = [
  ...lines.slice(0, startIndex),
  ...newLines,
  ...lines.slice(endIndex)
];

fs.writeFileSync(path, updatedLines.join('\n'));
console.log('Successfully patched TaskDetails.tsx');
