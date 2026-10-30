import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  XCircle,
  Eye,
  Clock,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  X
} from 'lucide-react';
import { useFleet } from '../context/FleetContext.jsx';

export default function ApprovalQueue() {
  const {
    user,
    pendingNotifications,
    allNotifications,
    handleNotificationDecision
  } = useFleet();

  const [editingMessages, setEditingMessages] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedModalNotif, setSelectedModalNotif] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  const modalRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (selectedModalNotif && modalRef.current && !modalRef.current.open) {
      modalRef.current.showModal();
    }
  }, [selectedModalNotif]);

  const closeReviewModal = () => {
    modalRef.current?.close();
    setSelectedModalNotif(null);
  };

  const getDraftText = (notif: any) => {
    return editingMessages[notif.id] !== undefined
      ? editingMessages[notif.id]
      : notif.message;
  };

  const handleTextChange = (id: string, value: string) => {
    setEditingMessages((prev) => ({ ...prev, [id]: value }));
  };

  const onApproveOrReject = async (notif: any, action: 'approve' | 'reject') => {
    setBusyId(notif.id);
    try {
      const msg = getDraftText(notif);
      await handleNotificationDecision(notif.id, msg, action);
      if (selectedModalNotif?.id === notif.id) {
        closeReviewModal();
      }
    } catch (err) {
      console.error('Approval error:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveAll = async () => {
    for (const notif of pendingNotifications) {
      await onApproveOrReject(notif, 'approve');
    }
  };

  const historyNotifications = allNotifications.filter(
    (n: any) => n.status !== 'pending_approval'
  );

  const displayedList =
    activeTab === 'pending' ? pendingNotifications : historyNotifications;

  const isDispatcher = user?.role === 'dispatcher';

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {isDispatcher
                ? 'Dispatcher Customer ETA Approval Queue'
                : `Customer Messages for My Stops (${user?.vehicleType || 'Van'} Route)`}
            </h2>
            <p className="text-xs text-slate-400">
              {isDispatcher
                ? 'Review, customize, and sign off on Gemini 2.5 Flash drafted SMS notifications before outbound dispatch'
                : 'Showing only customer notifications for stops on your assigned delivery route'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'pending'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending Sign-Off ({pendingNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dispatched Log ({historyNotifications.length})
            </button>
          </div>

          {isDispatcher && pendingNotifications.length > 1 && activeTab === 'pending' && (
            <button
              type="button"
              onClick={handleApproveAll}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20"
            >
              <Send className="h-3.5 w-3.5" /> Approve & Send All ({pendingNotifications.length})
            </button>
          )}
        </div>
      </div>

      {/* Queue Cards */}
      {displayedList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 py-14 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400/70 mb-2" />
          <h3 className="text-sm font-semibold text-white">
            {activeTab === 'pending'
              ? 'All Customer Notifications Reviewed!'
              : 'No Dispatched Notifications Yet'}
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            {activeTab === 'pending'
              ? 'Inject a disruption event in the Disruptions simulator to trigger route re-optimization and automated Gemini ETA message drafting.'
              : 'Approved or rejected notifications will appear here with full audit timestamps.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayedList.map((notif: any) => {
            const stop = notif.stop || {};
            const isPending = notif.status === 'pending_approval';
            const draftText = getDraftText(notif);

            return (
              <div
                key={notif.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg transition hover:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {stop.customer_name || 'Scheduled Customer'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                        <Phone className="h-3 w-3 text-indigo-400" />
                        {stop.customer_phone || '+1-415-555-0199'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                        <Sparkles className="h-3 w-3" /> Gemini 2.5 Flash Draft
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        {stop.address || 'San Francisco Delivery Stop'}
                      </span>
                      {notif.original_eta && notif.proposed_eta && (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                          <Clock className="h-3.5 w-3.5 text-amber-400" />
                          <span className="line-through text-slate-500">{notif.original_eta}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="font-bold text-amber-300">
                            New ETA: {notif.proposed_eta}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedModalNotif(notif)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition"
                    >
                      <Eye className="h-3.5 w-3.5" /> Side-by-Side Route & Message Review
                    </button>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        notif.status === 'pending_approval'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : notif.status === 'sent'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {notif.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Editable SMS Draft Area */}
                <div className="mt-3.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Outbound Customer SMS Message {isPending && isDispatcher ? '(Editable)' : ''}
                  </label>
                  <textarea
                    rows={2}
                    disabled={!isPending || !isDispatcher}
                    value={draftText}
                    onChange={(e) => handleTextChange(notif.id, e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-100 focus:border-indigo-500 focus:outline-none disabled:opacity-70"
                  />
                </div>

                {/* Action Footer */}
                {isPending && (
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      {isDispatcher
                        ? 'Dispatcher approval required before sending SMS and updating driver manifest.'
                        : 'Read-only view: Only Dispatchers can approve outbound customer communications.'}
                    </span>

                    {isDispatcher && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === notif.id}
                          onClick={() => onApproveOrReject(notif, 'reject')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" /> Reject Draft
                        </button>
                        <button
                          type="button"
                          disabled={busyId === notif.id}
                          onClick={() => onApproveOrReject(notif, 'approve')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 transition disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {busyId === notif.id ? 'Dispatching...' : 'Approve & Send'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Side-by-Side Approval Review Modal (Original Route vs Proposed Route + Editable Message) */}
      {selectedModalNotif && (
        <dialog
          ref={modalRef}
          onClose={() => setSelectedModalNotif(null)}
          onClick={(e) => {
            if (e.target === modalRef.current) closeReviewModal();
          }}
          className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-0 text-slate-100 shadow-2xl"
        >
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Side-by-Side Route Re-Optimization & Notification Review
                </h3>
                <p className="text-xs text-slate-400">
                  Compare original morning sequence vs. deterministic 2-Opt proposed sequence before dispatching
                </p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Side-by-Side Route Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Original Morning Route Sequence */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Original Route Sequence
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                    Pre-Disruption Plan
                  </span>
                </div>
                <div className="space-y-2">
                  {(
                    selectedModalNotif.route_change_summary?.originalSequenceList || [
                      selectedModalNotif.stop
                    ]
                  )
                    .filter(Boolean)
                    .map((s: any, idx: number) => (
                      <div
                        key={s.id || idx}
                        className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                          s.id === selectedModalNotif.stop_id
                            ? 'border-indigo-500/50 bg-indigo-500/10'
                            : 'border-slate-800 bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 font-mono text-[11px] font-bold text-slate-300">
                            {s.sequence_order || idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-white">{s.customer_name}</div>
                            <div className="text-[11px] text-slate-400">{s.address}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Right: Proposed 2-Opt Re-Sequenced Route */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Proposed Re-Optimized Sequence (NN + 2-Opt)
                  </span>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                    SLA Validated
                  </span>
                </div>
                <div className="space-y-2">
                  {(
                    selectedModalNotif.route_change_summary?.proposedSequenceList || [
                      selectedModalNotif.stop
                    ]
                  )
                    .filter(Boolean)
                    .map((s: any, idx: number) => {
                      const moved =
                        s.previous_sequence_order &&
                        s.previous_sequence_order !== s.sequence_order;
                      return (
                        <div
                          key={s.id || idx}
                          className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                            s.id === selectedModalNotif.stop_id
                              ? 'border-emerald-500/60 bg-emerald-500/15'
                              : 'border-slate-800 bg-slate-900/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 font-mono text-[11px] font-bold text-white">
                              {s.sequence_order || idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">
                                  {s.customer_name}
                                </span>
                                {moved && (
                                  <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono text-amber-300">
                                    #{s.previous_sequence_order} → #{s.sequence_order}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">{s.address}</div>
                            </div>
                          </div>
                          {s.estimated_arrival && (
                            <span className="font-mono text-[11px] text-emerald-300">
                              {new Date(s.estimated_arrival).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Editable Drafted Message inside Modal */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Customize Gemini Drafted Message for {selectedModalNotif.stop?.customer_name}
              </label>
              <textarea
                rows={3}
                value={getDraftText(selectedModalNotif)}
                onChange={(e) => handleTextChange(selectedModalNotif.id, e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={closeReviewModal}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
              {isDispatcher && selectedModalNotif.status === 'pending_approval' && (
                <>
                  <button
                    type="button"
                    onClick={() => onApproveOrReject(selectedModalNotif, 'reject')}
                    className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => onApproveOrReject(selectedModalNotif, 'approve')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    <Send className="h-3.5 w-3.5" /> Approve & Dispatch Now
                  </button>
                </>
              )}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

