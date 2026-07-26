import VideoPlayer from './VideoPlayer';

export default function LectureView({ topic, onBack }: { topic: string, onBack: () => void }) {
    return (
        <div className="min-h-dvh bg-black text-white flex flex-col">
            <button onClick={onBack} className="text-gray-400 p-4">⬅️ Back</button>
            <h1 className="text-xl font-bold px-4 mb-4">{topic}</h1>
            <div className="flex-grow">
                <VideoPlayer topic={topic} onClose={onBack} />
            </div>
        </div>
    );
}
