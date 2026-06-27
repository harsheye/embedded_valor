import { useState } from "react"
import { ChevronLeft, ChevronRight, Clock, Star, Film, Play } from "lucide-react"
import { Button } from "../../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"
import type { VideoItem } from "../../../types/media"

interface Calendar02Props {
  videos: VideoItem[];
  onPlayVideo: (video: VideoItem) => void;
}

export default function Calendar02({ videos, onPlayVideo }: Calendar02Props) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === undefined) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Find and group videos for the current month by day
  const monthVideos = videos.filter(video => {
    if (!(video as any).lastPlayedDate) return false;
    const d = new Date((video as any).lastPlayedDate);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Group by day of month
  const groupedByDay: Record<number, VideoItem[]> = {};
  monthVideos.forEach(video => {
    const d = new Date((video as any).lastPlayedDate);
    const day = d.getDate();
    if (!groupedByDay[day]) {
      groupedByDay[day] = [];
    }
    groupedByDay[day].push(video);
  });

  // Sort days descending (latest first)
  const sortedDays = Object.keys(groupedByDay)
    .map(Number)
    .sort((a, b) => b - a);

  const getDayName = (day: number) => {
    const date = new Date(year, month, day);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getMonthAbbr = () => {
    return monthNames[month].substring(0, 3);
  };

  return (
    <Card className="mx-auto w-full border" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <CardHeader className="m-0 w-full flex flex-row items-center justify-between gap-6 p-6 border-b border-neutral-800" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <CardTitle className="mb-1 text-xl font-semibold text-white">
            Upcoming Events and Activities
          </CardTitle>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', margin: 0 }}>
            List of watched media streams for {monthNames[month]} {year}.
          </p>
        </div>
        <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button variant="outline" onClick={handlePrevMonth} style={{ width: '32px', height: '32px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: '100px', textAlign: 'center', color: '#fff' }}>
            {monthNames[month]} {year}
          </span>
          <Button variant="outline" onClick={handleNextMonth} style={{ width: '32px', height: '32px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="px-6 pt-6 pb-6" style={{ maxHeight: '65vh', overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {sortedDays.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'rgba(255,255,255,0.4)' }}>
            <Film size={44} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <span>No viewing events tracked for this month.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {sortedDays.map(day => (
              <div key={day} style={{ display: 'flex', gap: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '1.25rem', flexWrap: 'wrap' }}>
                {/* Date card bubble */}
                <Card className="shrink-0 rounded-md border p-4" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', height: 'fit-content', minWidth: '110px' }}>
                  <p className="mb-1 font-semibold text-white" style={{ fontSize: '0.9rem', margin: 0 }}>{getDayName(day)}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>{getMonthAbbr()} {day}</p>
                </Card>
                
                {/* Video events lists */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minWidth: '220px' }}>
                  {groupedByDay[day].map((video, vIdx) => {
                    const playTime = (video as any).lastPlayedDate ? new Date((video as any).lastPlayedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
                    const rating = (video as any).rating || 0;
                    const watchedSeconds = (video as any).totalTimeWatched || 0;
                    const durationStr = typeof video.duration === 'number' ? formatTime(video.duration) : video.duration || 'Unknown';
                    
                    return (
                      <Card key={vIdx} className="rounded-md border p-4" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '180px' }}>
                            <h3 className="text-base font-semibold text-white" style={{ margin: '0 0 0.5rem 0', lineHeight: 1.3 }}>
                              {video.title}
                            </h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                                <Clock className="h-3.5 w-3.5" style={{ color: '#3b82f6' }} />
                                <span>Time: <b>{playTime}</b></span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                                <Play className="h-3.5 w-3.5" style={{ color: '#2ecc71' }} />
                                <span>Watched: <b>{formatTime(watchedSeconds)}</b> (Length: {durationStr})</span>
                              </div>
                              {rating > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#f59e0b' }}>
                                  <Star className="h-3.5 w-3.5" fill="#f59e0b" stroke="#f59e0b" style={{ color: '#f59e0b' }} />
                                  <span>Rating: <b>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</b></span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <Button 
                            variant="outline"
                            onClick={() => onPlayVideo(video)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', height: 'fit-content' }}
                          >
                            <Play size={10} fill="white" />
                            <span>Resume</span>
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
