interface ScrollProgressBarProps {
  progress: number;
}

const ScrollProgressBar = ({ progress }: ScrollProgressBarProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-black/50 backdrop-blur-sm">
      <div
        className="h-full bg-primary transition-all duration-100 ease-out"
        style={{
          width: `${progress * 100}%`,
          boxShadow: '0 0 10px hsl(217 91% 60% / 0.8), 0 0 20px hsl(217 91% 60% / 0.4)',
        }}
      />
    </div>
  );
};

export default ScrollProgressBar;
