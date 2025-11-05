import React, { useState, useEffect, useRef } from 'react';
import { listenToQueueChanges } from '../../services/firebaseService';
import { SpinnerIcon } from '../Icons';
import type { TranslationQueue } from '../../types';

export const TranslationStatusIndicator: React.FC = () => {
    const [queue, setQueue] = useState<TranslationQueue | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [initialTaskCount, setInitialTaskCount] = useState(0);
    const prevQueueSize = useRef(0);

    useEffect(() => {
        const unsubscribe = listenToQueueChanges((newQueue) => {
            const currentSize = newQueue ? Object.keys(newQueue).length : 0;

            // Detects a new batch submission
            if (currentSize > 0 && currentSize > prevQueueSize.current) {
                setInitialTaskCount(currentSize);
                setIsVisible(true);
            } else if (currentSize === 0 && prevQueueSize.current > 0) {
                // Batch finished, hide after a delay
                setTimeout(() => {
                    setIsVisible(false);
                    setInitialTaskCount(0);
                }, 2000);
            }
            
            setQueue(newQueue);
            prevQueueSize.current = currentSize;
        });
        return () => unsubscribe();
    }, []);

    const remainingTasks = queue ? Object.keys(queue).length : 0;
    const completedTasks = initialTaskCount - remainingTasks;

    let progress = 0;
    if (initialTaskCount > 0) {
        progress = (completedTasks / initialTaskCount) * 100;
    }

    if (!isVisible) {
        return null;
    }

    return (
        <div 
            className="fixed bottom-0 left-0 right-0 bg-[var(--color-bg-secondary)] shadow-[0_-4px_15px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_15px_rgba(0,0,0,0.4)] z-50 transition-transform duration-500"
            style={{ transform: isVisible && remainingTasks > 0 ? 'translateY(0)' : 'translateY(100%)' }}
        >
            <div className="max-w-4xl mx-auto p-3">
                <div className="flex items-center gap-4">
                    <SpinnerIcon className="w-6 h-6 text-[var(--color-accent-primary)] animate-spin" />
                    <div className="flex-grow">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {progress < 100 ? 'Đang xử lý...' : 'Hoàn tất!'}
                            </span>
                            <span className="text-sm font-mono font-semibold text-[var(--color-text-secondary)]">
                                {completedTasks} / {initialTaskCount}
                            </span>
                        </div>
                        <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-[var(--color-accent-primary)] h-2 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};