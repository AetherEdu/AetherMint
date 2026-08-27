'use client';

import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  FileCode,
  Terminal,
  Database,
  Zap,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Info
} from 'lucide-react';

interface ParamSchema {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: any;
}

interface EntryPoint {
  name: string;
  description: string;
  params: ParamSchema[];
}

interface ContractSchema {
  address: string;
  name: string;
  category: string;
  description: string;
  entryPoints: EntryPoint[];
}

interface StateDiff {
  key: string;
  beforeValue: any;
  afterValue: any;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
}

interface EmittedEvent {
  contractAddress: string;
  topics: string[];
  data: Record<string, any>;
  timestamp: number;
}

interface SimulationResult {
  status: 'SUCCESS' | 'REVERTED';
  contractAddress: string;
  functionName: string;
  callerAddress: string;
  returnValue?: any;
  revertReason?: string;
  stateDiffs: StateDiff[];
  emittedEvents: EmittedEvent[];
  gasUsed: number;
  cpuInstructions: number;
  memoryBytes: number;
  executionTimeMs: number;
  logs: string[];
  simulatedAt: string;
}

export default function AdminSimulatePage() {
  const [contracts, setContracts] = useState<ContractSchema[]>([]);
  const [selectedContractAddr, setSelectedContractAddr] = useState<string>('');
  const [selectedFunctionName, setSelectedFunctionName] = useState<string>('');
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  const [callerAddress, setCallerAddress] = useState<string>('GADMIN111111111111111111111111111111111111111');
  const [simulateRevert, setSimulateRevert] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  // Fetch contracts list on mount
  useEffect(() => {
    async function loadContracts() {
      try {
        const res = await fetch('/api/admin/simulate/contracts');
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            setContracts(body.data);
            if (body.data.length > 0) {
              const firstContract = body.data[0];
              setSelectedContractAddr(firstContract.address);
              if (firstContract.entryPoints.length > 0) {
                const firstFunc = firstContract.entryPoints[0];
                setSelectedFunctionName(firstFunc.name);
                populateDefaults(firstFunc);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load contract schemas:', error);
      }
    }
    loadContracts();
  }, []);

  const populateDefaults = (func: EntryPoint) => {
    const defaults: Record<string, any> = {};
    func.params.forEach(p => {
      defaults[p.name] = p.defaultValue !== undefined ? p.defaultValue : '';
    });
    setParamValues(defaults);
  };

  const selectedContract = contracts.find(c => c.address === selectedContractAddr);
  const selectedEntryPoint = selectedContract?.entryPoints.find(e => e.name === selectedFunctionName);

  const handleContractChange = (addr: string) => {
    setSelectedContractAddr(addr);
    const contract = contracts.find(c => c.address === addr);
    if (contract && contract.entryPoints.length > 0) {
      const firstFunc = contract.entryPoints[0];
      setSelectedFunctionName(firstFunc.name);
      populateDefaults(firstFunc);
    }
    setSimulationResult(null);
  };

  const handleFunctionChange = (funcName: string) => {
    setSelectedFunctionName(funcName);
    const func = selectedContract?.entryPoints.find(e => e.name === funcName);
    if (func) {
      populateDefaults(func);
    }
    setSimulationResult(null);
  };

  const handleParamChange = (paramName: string, value: any) => {
    setParamValues(prev => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleRunSimulation = async () => {
    if (!selectedContractAddr || !selectedFunctionName) return;

    setLoading(true);
    setExecutionMessage(null);
    try {
      const res = await fetch('/api/admin/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress: selectedContractAddr,
          functionName: selectedFunctionName,
          args: paramValues,
          callerAddress,
          options: {
            simulateRevert,
          },
        }),
      });

      if (res.ok) {
        const body = await res.json();
        if (body.success && body.data) {
          setSimulationResult(body.data);
        }
      }
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteOnChain = () => {
    setExecutionMessage('Transaction preview confirmed! Simulating mock dispatch to on-chain network...');
    setTimeout(() => {
      setExecutionMessage('On-chain transaction successfully submitted and verified!');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-600/20 text-blue-400 rounded-xl">
              <Terminal className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Smart Contract Dry-Run Sandbox
            </h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Simulate contract entry point executions, preview storage state diffs, and inspect emitted events with zero state mutations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            Isolated Sandbox Active
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Contract & Parameter Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-400" />
              Contract Invocation Setup
            </h2>

            {/* Contract Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Target Contract
              </label>
              <select
                value={selectedContractAddr}
                onChange={(e) => handleContractChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {contracts.map(c => (
                  <option key={c.address} value={c.address}>
                    {c.name} ({c.category})
                  </option>
                ))}
              </select>
              {selectedContract && (
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  {selectedContract.address}
                </p>
              )}
            </div>

            {/* Entry Point Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Function Entry Point
              </label>
              <select
                value={selectedFunctionName}
                onChange={(e) => handleFunctionChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {selectedContract?.entryPoints.map(ep => (
                  <option key={ep.name} value={ep.name}>
                    {ep.name}()
                  </option>
                ))}
              </select>
              {selectedEntryPoint && (
                <p className="text-xs text-slate-400">
                  {selectedEntryPoint.description}
                </p>
              )}
            </div>

            {/* Dynamic Parameter Inputs */}
            {selectedEntryPoint && selectedEntryPoint.params.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Function Parameters
                </label>
                {selectedEntryPoint.params.map(p => (
                  <div key={p.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">
                        {p.name} {p.required && <span className="text-rose-400">*</span>}
                      </span>
                      <span className="text-slate-500 font-mono text-[10px]">{p.type}</span>
                    </div>
                    <input
                      type={p.type === 'number' ? 'number' : 'text'}
                      value={paramValues[p.name] !== undefined ? paramValues[p.name] : ''}
                      onChange={(e) => handleParamChange(p.name, p.type === 'number' ? Number(e.target.value) : e.target.value)}
                      placeholder={p.description}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Caller Address & Options */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Simulated Caller Address
                </label>
                <input
                  type="text"
                  value={callerAddress}
                  onChange={(e) => setCallerAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="simulateRevert"
                  checked={simulateRevert}
                  onChange={(e) => setSimulateRevert(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="simulateRevert" className="text-xs text-slate-300">
                  Force Simulate Execution Revert (Test Error Handling)
                </label>
              </div>
            </div>

            {/* Simulation Action Button */}
            <button
              onClick={handleRunSimulation}
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Dry-Run...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Execute Dry-Run Simulation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Simulation Results Inspector */}
        <div className="lg:col-span-7 space-y-6">
          {!simulationResult ? (
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500 space-y-4">
              <Activity className="w-12 h-12 text-slate-700 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-300">No Dry-Run Results Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Configure contract parameters on the left and click "Execute Dry-Run Simulation" to view expected state changes, emitted events, and gas estimates.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Banner */}
              <div
                className={`p-5 rounded-2xl border flex items-start justify-between ${
                  simulationResult.status === 'SUCCESS'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {simulationResult.status === 'SUCCESS' ? (
                    <CheckCircle className="w-6 h-6 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-rose-400 mt-0.5" />
                  )}
                  <div>
                    <h3 className="text-base font-bold">
                      Simulation Status: {simulationResult.status}
                    </h3>
                    <p className="text-xs opacity-90 mt-0.5">
                      {simulationResult.status === 'SUCCESS'
                        ? 'Dry-run executed cleanly with zero error signals. No on-chain state mutated.'
                        : `Revert Reason: ${simulationResult.revertReason}`}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono opacity-60">
                  {new Date(simulationResult.simulatedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* Execution Notification Banner */}
              {executionMessage && (
                <div className="p-4 bg-blue-900/40 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  {executionMessage}
                </div>
              )}

              {/* Resource Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" /> Gas Cost
                  </span>
                  <p className="text-base font-bold font-mono text-white">
                    {simulationResult.gasUsed.toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-blue-400" /> CPU Instruct.
                  </span>
                  <p className="text-base font-bold font-mono text-white">
                    {simulationResult.cpuInstructions.toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Database className="w-3 h-3 text-purple-400" /> Memory
                  </span>
                  <p className="text-base font-bold font-mono text-white">
                    {(simulationResult.memoryBytes / 1024).toFixed(1)} KB
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" /> Time
                  </span>
                  <p className="text-base font-bold font-mono text-white">
                    {simulationResult.executionTimeMs} ms
                  </p>
                </div>
              </div>

              {/* State Diffs Inspector */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  State Storage Changes ({simulationResult.stateDiffs.length})
                </h3>

                {simulationResult.stateDiffs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center italic">
                    No storage state keys modified during this execution.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {simulationResult.stateDiffs.map((diff, i) => (
                      <div key={i} className="bg-slate-950 border border-slate-800/90 p-3.5 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-blue-300">{diff.key}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              diff.action === 'CREATED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {diff.action}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="p-2 bg-slate-900/80 rounded border border-slate-800 text-slate-400">
                            <span className="text-[9px] uppercase block font-sans font-semibold text-slate-500">Before</span>
                            {diff.beforeValue !== null ? JSON.stringify(diff.beforeValue) : '<null>'}
                          </div>
                          <div className="p-2 bg-slate-900/80 rounded border border-slate-800 text-slate-200">
                            <span className="text-[9px] uppercase block font-sans font-semibold text-slate-500">After</span>
                            {JSON.stringify(diff.afterValue)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Emitted Events Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  Emitted Events ({simulationResult.emittedEvents.length})
                </h3>

                {simulationResult.emittedEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center italic">
                    No contract events emitted during dry-run execution.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {simulationResult.emittedEvents.map((evt, idx) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-purple-400 font-bold">
                            Topics: [{evt.topics.join(', ')}]
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <pre className="p-2 bg-slate-900 rounded text-slate-300 overflow-x-auto text-[11px]">
                          {JSON.stringify(evt.data, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Simulation Logs Console */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Execution Logs & Traces
                </h3>
                <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 rounded-xl space-y-1 max-h-48 overflow-y-auto border border-slate-800">
                  {simulationResult.logs.map((log, i) => (
                    <div key={i} className="leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Execute On-Chain */}
              {simulationResult.status === 'SUCCESS' && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleExecuteOnChain}
                    className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center gap-2"
                  >
                    <span>Confirm & Execute On-Chain Transaction</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
