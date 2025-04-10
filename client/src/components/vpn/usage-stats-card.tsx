import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { queryClient } from '@/lib/queryClient';
import { formatBytes } from '@/lib/utils';

type UsageStatsProps = {
  usageStats?: {
    totalUploaded: number;
    totalDownloaded: number;
    totalData: number;
    dailyData: {
      date: string;
      uploaded: number;
      downloaded: number;
    }[];
  };
};

export default function UsageStatsCard({ usageStats }: UsageStatsProps) {
  const [period, setPeriod] = useState('7days');
  
  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    queryClient.invalidateQueries({ queryKey: ['/api/usage'] });
  };
  
  // Default values if usageStats is undefined
  const totalUploaded = usageStats?.totalUploaded || 0;
  const totalDownloaded = usageStats?.totalDownloaded || 0;
  const totalData = usageStats?.totalData || 0;
  const dailyData = usageStats?.dailyData || [];
  
  // Format day labels
  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  return (
    <Card className="border border-gray-800 shadow-lg bg-gray-950">
      <CardHeader className="border-b border-gray-800 flex justify-between items-center p-5">
        <h3 className="font-medium">Usage Statistics</h3>
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="bg-gray-800 border-gray-700">
            <SelectValue placeholder="Select Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-5">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="text-2xl font-bold">{formatBytes(totalData)}</h4>
            <p className="text-sm text-gray-400 mt-1">Total data transferred</p>
          </div>
          <div className="text-right">
            <p className="text-sm">
              <span className="text-green-500">↑</span> {formatBytes(totalUploaded)} Upload
            </p>
            <p className="text-sm mt-1">
              <span className="text-teal-400">↓</span> {formatBytes(totalDownloaded)} Download
            </p>
          </div>
        </div>
        
        <div className="mt-6 h-48 relative">
          {/* Simple data visualization */}
          <div className="flex items-end justify-between h-full gap-2">
            {dailyData.slice(-7).map((day, index) => (
              <div key={index} className="flex flex-col items-center w-full">
                <div className="w-full flex h-32 gap-1">
                  <div 
                    className="bg-primary-700 rounded-t w-1/2" 
                    style={{ 
                      height: `${Math.min(100, Math.max(5, (day.uploaded / (totalUploaded / 7) * 100)))}%` 
                    }}
                  ></div>
                  <div 
                    className="bg-teal-700 rounded-t w-1/2" 
                    style={{ 
                      height: `${Math.min(100, Math.max(5, (day.downloaded / (totalDownloaded / 7) * 100)))}%` 
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-400 mt-2">{getDayLabel(day.date)}</div>
              </div>
            ))}
          </div>
          
          <div className="absolute -top-6 left-0 right-0 flex justify-center">
            <div className="flex items-center text-xs gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-primary-700"></div>
                <span>Upload</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-teal-700"></div>
                <span>Download</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="flex justify-between items-center">
            <div className="text-sm">
              <p className="text-gray-400">Premium Plan Quota</p>
              <p className="mt-1 font-medium">
                {formatBytes(totalData)} of 250 GB used ({Math.round(totalData / (250 * 1024 * 1024 * 1024) * 100)}%)
              </p>
            </div>
            <button className="text-teal-400 text-sm hover:text-teal-300">View Details</button>
          </div>
          <div className="mt-2 w-full bg-gray-800 rounded-full h-2">
            <div 
              className="bg-teal-500 h-2 rounded-full" 
              style={{ width: `${Math.min(100, Math.round(totalData / (250 * 1024 * 1024 * 1024) * 100))}%` }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
