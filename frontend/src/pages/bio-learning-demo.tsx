import React from 'react';
import Head from 'next/head';
import { BiometricProvider } from '../lib/biometrics/BiometricProvider';
import { BiometricMonitor } from '../components/Bio/BiometricMonitor';
import { StressLevelIndicator } from '../components/Bio/StressLevelIndicator';
import { AdaptiveContent } from '../components/Bio/AdaptiveContent';
import { HapticFeedback } from '../components/Bio/HapticFeedback';
import { BioFeedbackModule } from '../components/Bio/BioFeedbackModule';
import { useBiometrics } from '../hooks/useBiometrics';
import { Brain, Settings, Play, Info, AlertTriangle, ChevronRight } from 'lucide-react';

const DemoContent: React.FC = () => {
  const { isSimulationActive, setSimulationActive, simulateEvent } = useBiometrics();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <HapticFeedback />
      
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-30 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Brain className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">StarkEd <span className="text-indigo-600">BioLearn</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium">
             <div className={`w-2 h-2 rounded-full ${isSimulationActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
             {isSimulationActive ? 'Biometric Link Active' : 'Sensor Disconnected'}
          </div>
          <button 
            onClick={() => setSimulationActive(!isSimulationActive)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column - Lesson Content */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center gap-2 text-indigo-600 text-sm font-bold uppercase tracking-wider mb-4">
                <span>Unit 4</span>
                <ChevronRight className="w-4 h-4" />
                <span>Advanced Neural Networks</span>
              </div>
              <h2 className="text-4xl font-black text-gray-900 mb-6 leading-tight">Implementing Transformers for Sequence-to-Sequence Modeling</h2>
              
              <AdaptiveContent>
                <div className="prose prose-lg text-gray-600 space-y-6">
                  <p>
                    The Transformer architecture has revolutionized the field of Natural Language Processing. Unlike previous recurrent models, Transformers rely entirely on self-attention mechanisms to compute representations of their input and output without using sequence-aligned RNNs or convolution.
                  </p>
                  
                  <div className="bg-gray-900 rounded-2xl p-6 my-8 overflow-x-auto text-indigo-300 font-mono text-sm">
                    <pre>{`class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super(MultiHeadAttention, self).__init__()
        self.num_heads = num_heads
        self.d_model = d_model
        assert d_model % self.num_heads == 0`}
                    </pre>
                  </div>

                  <p>
                    The key innovation of the Transformer is the <strong>Scaled Dot-Product Attention</strong>, which allows the model to globally attend to all tokens in a sequence regardless of their distance. This parallelization significantly reduces training time and allows for training larger models.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                      <h4 className="font-bold text-indigo-900 mb-2">Self-Attention</h4>
                      <p className="text-sm">Mechanisms that relate different positions of a single sequence.</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h4 className="font-bold text-blue-900 mb-2">Positional Encoding</h4>
                      <p className="text-sm">Injecting information about the relative positions of tokens.</p>
                    </div>
                  </div>
                </div>
              </AdaptiveContent>
            </div>

            {/* Bio-Feedback Training Area */}
            <div className="pt-4">
              <BioFeedbackModule />
            </div>
          </div>

          {/* Right Column - Biometric Dashboard */}
          <div className="lg:col-span-4 space-y-6 sticky top-28 h-fit">
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4">
                <Play className="w-4 h-4 text-green-500 fill-current" />
              </div>
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                Live Bio-Diagnostics
              </h3>
              
              <StressLevelIndicator />
              
              <div className="mt-8">
                <BiometricMonitor />
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <h4 className="text-xs font-black uppercase text-gray-400 mb-4 flex items-center gap-2">
                  <Play className="w-3 h-3" /> Simulation Control
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => simulateEvent('stress')}
                    className="flex-1 bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-100 border border-red-100"
                  >
                    High Stress
                  </button>
                  <button 
                    onClick={() => simulateEvent('focus')}
                    className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 border border-blue-100"
                  >
                    Flow State
                  </button>
                  <button 
                    onClick={() => simulateEvent('calm')}
                    className="flex-1 bg-green-50 text-green-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-green-100 border border-green-100"
                  >
                    Deep Calm
                  </button>
                </div>
              </div>
            </div>

            {/* Helpful Tips */}
            <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg overflow-hidden relative">
               <Info className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
               <h4 className="font-bold mb-2">Biology Principle #4</h4>
               <p className="text-indigo-100 text-sm leading-relaxed">
                 Optimal information retention occurs when heart rate variability is high and EEG alpha waves are stable. Keep your focus level above 70% for best results.
               </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default function BioLearningDemo() {
  return (
    <BiometricProvider>
      <Head>
        <title>Bio-Integrated Learning | StarkEd</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <DemoContent />
    </BiometricProvider>
  );
}
