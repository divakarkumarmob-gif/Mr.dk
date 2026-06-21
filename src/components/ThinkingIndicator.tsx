import React from 'react';
import { motion } from 'motion/react';

const ThinkingIndicator: React.FC = () => {
    return (
        <div className="flex items-center text-sm italic text-gray-300">
            <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
                Thinking
            </motion.span>
            <span className="inline-flex gap-0.5 ml-1">
                {[0, 0.33, 0.66].map((delay, i) => (
                    <motion.span
                        key={i}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay: delay, ease: "easeInOut" }}
                    >
                        .
                    </motion.span>
                ))}
            </span>
        </div>
    );
};

export default ThinkingIndicator;
