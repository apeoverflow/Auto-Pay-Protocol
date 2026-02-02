import { ActivityList } from '../components/activity'
import { Input } from '../components/ui/input'
import { Search, Download } from 'lucide-react'
import { Button } from '../components/ui/button'

export function ActivityPage() {
  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 flex-shrink-0">
        <p className="text-sm text-muted-foreground">
          Your transaction history and events
        </p>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              className="pl-9 bg-white"
            />
          </div>
          <Button variant="outline" className="shadow-sm flex-shrink-0">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* List with filters */}
      <div className="flex-1 min-h-0 overflow-auto">
        <ActivityList showAll />
      </div>
    </div>
  )
}
