import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Calendar, User, CalendarIcon, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, ChevronDown, IndianRupee, Printer, LogOut, Mail } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import BasicDatePicker from './ui/calendar-new';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { format } from 'date-fns';
import { useTheme } from '../App';
import { useAuth } from '../contexts/AuthContext';
import lineService from '../services/lineService';
import collectionService from '../services/collectionService';
import pdfService from '../services/pdfService';
import LoadingScreen from './LoadingScreen';
import ProfileDropdownWithSync from './ProfileDropdownWithSync';

const Collections = () => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lineId = searchParams.get('id');
  const dayParam = searchParams.get('day');

  const [line, setLine] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date()); // Default to today's date
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [filteredGoingTransactions, setFilteredGoingTransactions] = useState([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [filteredGoingTotal, setFilteredGoingTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [datesWithTransactions, setDatesWithTransactions] = useState([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [bfAmount, setBfAmount] = useState(0);
  const [availableDays, setAvailableDays] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [showAllDays, setShowAllDays] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Print modal states
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printFromDate, setPrintFromDate] = useState(new Date());
  const [printToDate, setPrintToDate] = useState(new Date());
  const [isFromDateOpen, setIsFromDateOpen] = useState(false);
  const [isToDateOpen, setIsToDateOpen] = useState(false);
  const [printSelectedDays, setPrintSelectedDays] = useState([]);
  const [printDateMode, setPrintDateMode] = useState('single');
  const [printSingleDate, setPrintSingleDate] = useState(new Date());
  const [isSingleDateOpen, setIsSingleDateOpen] = useState(false);

  useEffect(() => {
    if (lineId) {
      loadLineData();
    }
  }, [lineId]);

  useEffect(() => {
    if (lineId && selectedDays.length > 0) {
      loadCollections();
    }
  }, [lineId, selectedDays, selectedDate]);

  const loadLineData = async () => {
    try {
      setLoading(true);
      const lineData = await lineService.getLineById(lineId);
      setLine(lineData.line);
      setBfAmount(lineData.line.currentBF || 0);

      const daysData = await lineService.getDays(lineId);
      const days = daysData.days || [];
      setAvailableDays(days);

      if (dayParam) {
        const daysFromUrl = dayParam.split(',');
        setSelectedDays(daysFromUrl);
      } else {
        setSelectedDays(days.length > 0 ? [days[0]] : []);
      }
    } catch (err) {
      // console.error('Error loading line:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Pass selectedDate to backend for filtering
      const filters = {
        days: selectedDays.join(','),
        date: selectedDateStr
      };

      const data = await collectionService.getCollections(lineId, filters);
      
      // Use backend-filtered data directly
      const incoming = data.incomingTransactions || [];
      const going = data.goingTransactions || [];
      
      setFilteredTransactions(incoming);
      setFilteredGoingTransactions(going);

      // Use totals from backend
      const totals = data.totals || {};
      setFilteredTotal(totals.incoming || 0);
      setFilteredGoingTotal(totals.going || 0);
      setTotalAmount(totals.netFlow || 0);

      // Get unique dates from backend for calendar highlighting
      // Load all dates without date filter for calendar
      const allDatesFilters = {
        days: selectedDays.join(',')
      };
      const allDatesData = await collectionService.getCollections(lineId, allDatesFilters);
      const dates = (allDatesData.uniqueDates || []).map(d => new Date(d + 'T00:00:00'));
      setDatesWithTransactions(dates);

    } catch (err) {
      // console.error('Error loading collections:', err);
    }
  };

  const generatePDF = async () => {
    // Determine date range based on mode
    let fromDateStr, toDateStr;
    if (printDateMode === 'single') {
      fromDateStr = toDateStr = format(printSingleDate, 'yyyy-MM-dd');
    } else {
      fromDateStr = format(printFromDate, 'yyyy-MM-dd');
      toDateStr = format(printToDate, 'yyyy-MM-dd');
    }
    
    // Call backend PDF generation endpoint
    try {
      const filters = {
        days: printSelectedDays.join(','),
        dateFrom: fromDateStr,
        dateTo: toDateStr
      };
      
      // Call backend to generate and download PDF
      await pdfService.downloadCollectionsPDF(lineId, filters);
      
      setIsPrintModalOpen(false);
      
    } catch (err) {
      // console.error('Error generating PDF:', err);
      alert(err.message || 'Failed to generate PDF');
    }
  };

  const handleShowPreview = () => {
    // Preview functionality can be implemented here
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!line) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p>Line not found</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === 'light' 
        ? 'bg-slate-50' 
        : 'bg-slate-900'
    }`}>
      {/* BRAND NEW HEADER - COMPACT & ALIGNED */}
      <header className={`sticky top-0 z-20 border-b shadow-md backdrop-blur-xl ${
        theme === 'light'
          ? 'trading-bg border-slate-200'
          : 'bg-slate-900/95 border-slate-700'
      }`}>
        {/* Chart bars for trading visualization */}
        {theme === 'light' && (
          <>
            <div className="chart-bars">
              <div className="chart-bar"></div>
              <div className="chart-bar"></div>
              <div className="chart-bar"></div>
              <div className="chart-bar"></div>
              <div className="chart-bar"></div>
              <div className="chart-bar"></div>
              <div className="chart-bar"></div>
              <div className="chart-bar"></div>
            </div>
            <div className="chart-dots">
              <div className="chart-dot"></div>
              <div className="chart-dot"></div>
              <div className="chart-dot"></div>
              <div className="chart-dot"></div>
              <div className="chart-dot"></div>
            </div>
          </>
        )}
        <div className="container mx-auto px-4 py-3 relative z-10">
          {/* Back Button - Absolutely positioned and centered */}
          <Button 
            onClick={() => navigate(-1)} 
            variant="ghost" 
            size="icon"
            className={`absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex-shrink-0 shadow-md transition-all hover:shadow-lg z-20 ${
              theme === 'light'
                ? 'bg-white/80 hover:bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900'
                : 'hover:bg-slate-800'
            }`}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Top Row with absolute centered BF Badge */}
          <div className="relative flex items-center justify-between gap-4 mb-2">
            {/* Left: Title (with Main Line below) - with padding for back button */}
            <div className="flex items-center gap-3 pl-14">
              <div className="flex flex-col gap-1">
                <h1 className={`text-2xl md:text-3xl font-bold ${
                  theme === 'light'
                    ? 'text-slate-800'
                    : 'text-blue-400'
                } whitespace-nowrap leading-none`}>
                  Collections
                </h1>
                
                <span className={`inline-block self-start px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                  theme === 'light'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-blue-900/30 text-blue-400 border border-blue-700'
                }`}>
                  {line?.name || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Center: BF Badge (absolute positioned) */}
            <div className={`hidden md:inline-flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-2 px-5 py-2 rounded-full shadow-lg transition-all hover:shadow-xl ${
              theme === 'light'
                ? 'bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-2 border-emerald-300'
                : 'bg-slate-800/50 border border-slate-700'
            }`}>
              <span className="text-base">💼</span>
              <span className={`text-xs font-semibold uppercase tracking-wider ${
                theme === 'light' ? 'text-emerald-700' : 'text-slate-400'
              }`}>
                BF
              </span>
              <span className={`text-lg font-bold ${
                theme === 'light'
                  ? 'text-emerald-900'
                  : 'text-blue-400'
              }`}>
                ₹{bfAmount.toFixed(2)}
              </span>
            </div>

            {/* Right: Day selector + Date picker */}
            <div className="flex items-center gap-3">
              {/* Day multiselect - SECOND */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`h-10 w-auto min-w-32 max-w-48 text-sm font-semibold shadow-md transition-all hover:shadow-lg ${
                      theme === 'light'
                        ? 'bg-gradient-to-br from-blue-50 to-white border-2 border-blue-300 text-blue-900 hover:from-blue-100 hover:to-white hover:border-blue-400'
                        : 'bg-slate-800 border-slate-600'
                    }`}
                  >
                    <ChevronDown className="h-4 w-4 mr-2" />
                    <span className="truncate">
                      {selectedDays.length === 0 
                        ? 'Select Days' 
                        : selectedDays.length === 1 
                          ? selectedDays[0] 
                          : `${selectedDays.length} Days`}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={`w-56 p-2 ${
                  theme === 'light' ? 'bg-white' : 'bg-slate-800'
                }`} align="end">
                  <div className="space-y-1">
                    {/* Select All Option */}
                    {availableDays.length > 0 && (
                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors border-b ${
                          theme === 'light'
                            ? 'hover:bg-amber-50 border-slate-200'
                            : 'hover:bg-slate-700 border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDays.length === availableDays.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Select all days
                              setSelectedDays(availableDays);
                              setShowAllDays(true);
                              setSearchParams({ id: lineId, day: availableDays.join(',') }, { replace: true });
                            } else {
                              // Deselect all - reset to first day
                              const firstDay = availableDays[0];
                              setSelectedDays([firstDay]);
                              setShowAllDays(false);
                              setSearchParams({ id: lineId, day: firstDay }, { replace: true });
                            }
                          }}
                          className="w-4 h-4 rounded border-2 border-amber-500"
                        />
                        <span className={`text-sm font-bold ${
                          theme === 'light' ? 'text-amber-700' : 'text-amber-400'
                        }`}>
                          Select All
                        </span>
                      </label>
                    )}
                    
                    {availableDays.map((availableDay) => (
                      <label
                        key={availableDay}
                        className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                          theme === 'light'
                            ? 'hover:bg-blue-50'
                            : 'hover:bg-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDays.includes(availableDay)}
                          onChange={(e) => {
                            let newSelectedDays;
                            if (e.target.checked) {
                              newSelectedDays = [...selectedDays, availableDay];
                            } else {
                              newSelectedDays = selectedDays.filter(d => d !== availableDay);
                              if (newSelectedDays.length === 0) {
                                newSelectedDays = [availableDay]; // Keep at least one
                                return;
                              }
                            }
                            setSelectedDays(newSelectedDays);
                            setShowAllDays(newSelectedDays.length === availableDays.length);
                            setSearchParams({ id: lineId, day: newSelectedDays.join(',') }, { replace: true });
                          }}
                          className="w-4 h-4 rounded border-2 border-blue-500"
                        />
                        <span className={`text-sm font-medium ${
                          theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                        }`}>
                          {availableDay}
                        </span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Date picker - THIRD */}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`h-10 px-4 text-sm font-semibold shadow-md transition-all hover:shadow-lg ${
                      theme === 'light'
                        ? 'bg-gradient-to-br from-purple-50 to-white border-2 border-purple-300 text-purple-900 hover:from-purple-100 hover:to-white hover:border-purple-400'
                        : 'bg-slate-800 border-slate-600'
                    }`}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">{format(selectedDate, 'MMM dd, yyyy')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <BasicDatePicker
                    value={selectedDate}
                    onChange={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setCalendarOpen(false);
                      }
                    }}
                    onOpenChange={setCalendarOpen}
                    highlightedDates={datesWithTransactions}
                  />
                </PopoverContent>
              </Popover>

              {/* Profile Dropdown with Sync */}
              <ProfileDropdownWithSync theme={theme} />
            </div>
          </div>

          {/* Mobile BF Badge */}
          <div className={`md:hidden inline-flex items-center gap-2 px-5 py-2 rounded-full mb-3 shadow-lg ${
            theme === 'light'
              ? 'bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-2 border-emerald-300'
              : 'bg-slate-800/50 border border-slate-700'
          }`}>
            <span className="text-base">💼</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              theme === 'light' ? 'text-emerald-700' : 'text-slate-400'
            }`}>
              BF
            </span>
            <span className={`text-lg font-bold ${
              theme === 'light'
                ? 'text-emerald-900'
                : 'text-blue-400'
            }`}>
              ₹{bfAmount.toFixed(2)}
            </span>
          </div>

          {/* Tab Navigation and Print Button Row - Centered with Print on Right */}
          <div className="relative flex justify-center items-center">
            <div className="relative">
              <div className={`inline-flex items-center rounded-full p-1 min-w-[480px] ${
                theme === 'light'
                  ? 'bg-slate-100 border border-slate-200'
                  : 'bg-slate-800 border border-slate-700'
              }`}>
                {/* Smooth Sliding Background */}
                <div 
                  className={`absolute top-1 bottom-1 rounded-full transition-all duration-200 ease-out ${
                    activeTab === 'going'
                      ? 'bg-red-500 shadow-lg'
                      : activeTab === 'incoming'
                        ? 'bg-blue-500 shadow-lg'
                        : 'bg-purple-500 shadow-lg'
                  }`}
                  style={{
                    left: activeTab === 'going' 
                      ? '4px' 
                      : activeTab === 'incoming' 
                        ? 'calc(33.333% + 2px)' 
                        : 'calc(66.666% + 0px)',
                    width: 'calc(33.333% - 6px)',
                    transform: 'translateZ(0)',
                    willChange: 'left'
                  }}
                />
                
                <button
                  onClick={() => setActiveTab('going')}
                  className={`relative flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-colors duration-150 z-10 ${
                    activeTab === 'going'
                      ? 'text-white'
                      : theme === 'light'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  <span>Going</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('incoming')}
                  className={`relative flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-colors duration-150 z-10 ${
                    activeTab === 'incoming'
                      ? 'text-white'
                      : theme === 'light'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowDownCircle className="h-4 w-4" />
                  <span>Incoming</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('all')}
                  className={`relative flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-colors duration-150 z-10 ${
                    activeTab === 'all'
                      ? 'text-white'
                      : theme === 'light'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <IndianRupee className="h-4 w-4" />
                  <span>All</span>
                </button>
              </div>
            </div>
            
            {/* Print Button - Absolute positioned to right */}
            <Button
              onClick={() => {
                setPrintSelectedDays(availableDays);
                setPrintSingleDate(selectedDate);
                setIsPrintModalOpen(true);
              }}
              variant="outline"
              className={`absolute right-0 h-10 px-4 text-sm font-semibold shadow-md transition-all hover:shadow-lg ${
                theme === 'light'
                  ? 'bg-gradient-to-br from-green-50 to-white border-2 border-green-300 text-green-900 hover:from-green-100 hover:to-white hover:border-green-400'
                  : 'bg-slate-800 border-slate-600 text-slate-200 hover:text-white'
              }`}
            >
              <Printer className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-6xl mx-auto">
          {/* Going Tab Content */}
          {activeTab === 'going' && (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-3xl">
                <div className={`rounded-xl p-5 shadow-lg border ${
                  theme === 'light'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-slate-800/80 border-red-500/30'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      theme === 'light'
                        ? 'bg-red-100 border-2 border-red-300'
                        : 'bg-red-500/20 border-2 border-red-500/30'
                    }`}>
                      <ArrowUpCircle className={`w-6 h-6 ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Total Going Out
                      </p>
                      <p className={`text-2xl font-bold ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}>
                        ₹{filteredGoingTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl p-5 shadow-lg border ${
                  theme === 'light'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-slate-800/80 border-orange-500/30'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      theme === 'light'
                        ? 'bg-orange-100 border-2 border-orange-300'
                        : 'bg-orange-500/20 border-2 border-orange-500/30'
                    }`}>
                      <IndianRupee className={`w-6 h-6 ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Transactions
                      </p>
                      <p className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                        {filteredGoingTransactions.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction List */}
              <div className={`rounded-xl shadow-xl border overflow-hidden ${
                theme === 'light'
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-800/50 border-slate-700'
              }`}>
                <div className={`px-6 py-4 border-b ${
                  theme === 'light'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-red-500/20 border-red-500/30'
                }`}>
                  <h2 className={`text-lg font-bold flex items-center ${
                    theme === 'light' ? 'text-red-700' : 'text-red-400'
                  }`}>
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Going Transactions
                  </h2>
                </div>

                {filteredGoingTransactions.length === 0 ? (
                  <div className={`text-center py-12 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>
                    <ArrowUpCircle className="w-16 h-16 mx-auto mb-3 opacity-30" />
                    <p>No outgoing transactions on this date</p>
                  </div>
                ) : (
                  <div className={`divide-y ${theme === 'light' ? 'divide-slate-200' : 'divide-slate-700/50'}`}>
                    {filteredGoingTransactions.map((trans, index) => (
                      <div 
                        key={`going-${trans.customerId}-${trans.id}-${index}`}
                        className={`px-4 py-3 transition-colors ${
                          theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-slate-700/30'
                        }`}
                      >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                className="relative group/profile"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const tooltip = e.currentTarget.querySelector('.tooltip-content');
                                  if (tooltip) {
                                    tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                    tooltip.style.top = `${rect.top - 10}px`;
                                  }
                                }}
                              >
                                <div className={`w-9 h-9 rounded-full bg-red-500 flex items-center justify-center font-bold text-white text-xs border ${
                                  theme === 'light' ? 'border-red-400/50' : 'border-red-400/30'
                                }`}>
                                  {trans.customerName ? trans.customerName.substring(0, 2).toUpperCase() : trans.customerId.slice(-2)}
                                </div>
                                
                                {/* Hover Tooltip - Fixed Position */}
                                {trans.customerDetails && (
                                  <div className={`tooltip-content fixed -translate-x-1/2 -translate-y-full w-64 border p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-200 z-[9999] text-xs space-y-1.5 backdrop-blur-xl pointer-events-none ${theme === 'light' ? 'bg-white border-gray-200 text-gray-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}`}>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Name:</strong> {trans.customerDetails.name}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>ID:</strong> {trans.customerDetails.id}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Village:</strong> {trans.customerDetails.village || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Phone:</strong> {trans.customerDetails.phone || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Taken Amount:</strong> ₹{trans.customerDetails.takenAmount || 0}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Interest:</strong> {trans.customerDetails.interest || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>PC:</strong> {trans.customerDetails.pc || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Date:</strong> {trans.customerDetails.date || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Weeks:</strong> {trans.customerDetails.weeks || 'N/A'}</p>
                                  </div>
                                )}
                              </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-semibold text-sm truncate ${
                                  theme === 'light' ? 'text-slate-800' : 'text-slate-200'
                                }`}>
                                  {trans.customerName || 'Unknown Customer'}
                                </p>
                                {trans.day && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    theme === 'light' 
                                      ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  }`}>
                                    {trans.day}
                                  </span>
                                )}
                                {trans.isDeleted && (
                                  <span className="text-red-500 text-lg leading-none" title="Customer Deleted">🔴</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {trans.comment && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    theme === 'light'
                                      ? 'bg-orange-100 border border-orange-300 text-orange-700'
                                      : 'bg-orange-500/20 border border-orange-500/30 text-orange-400'
                                  }`}>
                                    {trans.type === 'renewal' ? 'RENEWAL' : trans.type === 'customer_creation' ? 'NEW' : 'RESTORE'}
                                  </span>
                                )}
                                <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                  ID: {trans.customerId}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-bold ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}>
                              -₹{trans.amount.toFixed(2)}
                            </p>
                            <div className="flex items-center justify-end gap-2">
                              <p className={`text-xs flex items-center ${
                                theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                              }`}>
                                <Calendar className="w-3 h-3 mr-1" />
                                {trans.date}
                              </p>
                              {trans.isEdited && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                  theme === 'light' 
                                    ? 'bg-red-100 text-red-700 border border-red-300' 
                                    : 'bg-red-900/40 text-red-300 border border-red-500/50'
                                }`}>
                                  Edited
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Incoming Tab Content */}
          {activeTab === 'incoming' && (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-3xl">
                <div className={`rounded-xl p-5 shadow-lg border ${
                  theme === 'light'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-slate-800/80 border-blue-500/30'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      theme === 'light'
                        ? 'bg-blue-100 border-2 border-blue-300'
                        : 'bg-blue-500/20 border-2 border-blue-500/30'
                    }`}>
                      <ArrowDownCircle className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Total Collected
                      </p>
                      <p className={`text-2xl font-bold ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                        ₹{filteredTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl p-5 shadow-lg border ${
                  theme === 'light'
                    ? 'bg-indigo-50 border-indigo-200'
                    : 'bg-slate-800/80 border-indigo-500/30'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      theme === 'light'
                        ? 'bg-indigo-100 border-2 border-indigo-300'
                        : 'bg-indigo-500/20 border-2 border-indigo-500/30'
                    }`}>
                      <IndianRupee className={`w-6 h-6 ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Transactions
                      </p>
                      <p className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                        {filteredTransactions.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction List */}
              <div className={`rounded-xl shadow-xl border overflow-hidden ${
                theme === 'light'
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-800/50 border-slate-700'
              }`}>
                <div className={`px-6 py-4 border-b ${
                  theme === 'light'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-blue-500/20 border-blue-500/30'
                }`}>
                  <h2 className={`text-lg font-bold flex items-center ${
                    theme === 'light' ? 'text-blue-700' : 'text-blue-400'
                  }`}>
                    <TrendingDown className="w-5 h-5 mr-2" />
                    Incoming Transactions
                  </h2>
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className={`text-center py-12 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>
                    <ArrowDownCircle className="w-16 h-16 mx-auto mb-3 opacity-30" />
                    <p>No collections on this date</p>
                  </div>
                ) : (
                  <div className={`divide-y ${theme === 'light' ? 'divide-slate-200' : 'divide-slate-700/50'}`}>
                    {filteredTransactions.map((trans, index) => (
                      <div 
                        key={`incoming-${trans.customerId}-${trans.id}-${index}`}
                        className={`px-4 py-3 transition-colors ${
                          theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-slate-700/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div 
                              className="relative group/profile"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const tooltip = e.currentTarget.querySelector('.tooltip-content');
                                if (tooltip) {
                                  tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                  tooltip.style.top = `${rect.top - 10}px`;
                                }
                              }}
                            >
                              <div className={`w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white text-xs border ${
                                theme === 'light' ? 'border-blue-400/50' : 'border-blue-400/30'
                              }`}>
                                {trans.customerName ? trans.customerName.substring(0, 2).toUpperCase() : trans.customerId.slice(-2)}
                              </div>
                              
                              {/* Hover Tooltip - Fixed Position */}
                              {trans.customerDetails && (
                                <div className={`tooltip-content fixed -translate-x-1/2 -translate-y-full w-64 border p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-200 z-[9999] text-xs space-y-1.5 backdrop-blur-xl pointer-events-none ${theme === 'light' ? 'bg-white border-gray-200 text-gray-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}`}>
                                  <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Name:</strong> {trans.customerDetails.name}</p>
                                  <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>ID:</strong> {trans.customerDetails.id}</p>
                                  <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Village:</strong> {trans.customerDetails.village || 'N/A'}</p>
                                  <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Phone:</strong> {trans.customerDetails.phone || 'N/A'}</p>
                                  <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Taken Amount:</strong> ₹{trans.customerDetails.takenAmount || 0}</p>
                                  <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Interest:</strong> {trans.customerDetails.interest || 'N/A'}</p>
                                  <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>PC:</strong> {trans.customerDetails.pc || 'N/A'}</p>
                                  <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Date:</strong> {trans.customerDetails.date || 'N/A'}</p>
                                  <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Weeks:</strong> {trans.customerDetails.weeks || 'N/A'}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-semibold text-sm truncate ${
                                  theme === 'light' ? 'text-slate-800' : 'text-slate-200'
                                }`}>
                                  {trans.customerName || 'Unknown Customer'}
                                </p>
                                {trans.day && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    theme === 'light' 
                                      ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  }`}>
                                    {trans.day}
                                  </span>
                                )}
                                {trans.isDeleted && (
                                  <span className="text-red-500 text-lg leading-none" title="Customer Deleted">🔴</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {trans.comment && (
                                  <p className={`text-xs italic truncate ${
                                    theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'
                                  }`}>
                                    {trans.comment}
                                  </p>
                                )}
                                <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                  ID: {trans.customerId}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-bold ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                              +₹{trans.amount || 0}
                            </p>
                            <div className="flex items-center justify-end gap-2">
                              <p className={`text-xs flex items-center ${
                                theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                              }`}>
                                <Calendar className="w-3 h-3 mr-1" />
                                {trans.date}
                              </p>
                              {trans.isEdited && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                  theme === 'light' 
                                    ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                                    : 'bg-blue-900/40 text-blue-300 border border-blue-500/50'
                                }`}>
                                  Edited
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All Tab Content */}
          {activeTab === 'all' && (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className={`rounded-xl p-5 shadow-lg border ${
                  theme === 'light'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-slate-800/80 border-blue-500/30'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      theme === 'light'
                        ? 'bg-blue-100 border-2 border-blue-300'
                        : 'bg-blue-500/20 border-2 border-blue-500/30'
                    }`}>
                      <IndianRupee className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Net Flow
                      </p>
                      <p className={`text-2xl font-bold ${
                        (filteredTotal - filteredGoingTotal) >= 0 
                          ? (theme === 'light' ? 'text-blue-600' : 'text-blue-400')
                          : (theme === 'light' ? 'text-red-600' : 'text-red-400')
                      }`}>
                        ₹{(filteredTotal - filteredGoingTotal).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl p-5 shadow-lg border ${
                  theme === 'light'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-slate-800/80 border-blue-500/30'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      theme === 'light'
                        ? 'bg-blue-100 border-2 border-blue-300'
                        : 'bg-blue-500/20 border-2 border-blue-500/30'
                    }`}>
                      <ArrowDownCircle className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Incoming
                      </p>
                      <p className={`text-2xl font-bold ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                        ₹{filteredTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl p-5 shadow-lg border ${
                  theme === 'light'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-slate-800/80 border-red-500/30'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      theme === 'light'
                        ? 'bg-red-100 border-2 border-red-300'
                        : 'bg-red-500/20 border-2 border-red-500/30'
                    }`}>
                      <ArrowUpCircle className={`w-6 h-6 ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Going
                      </p>
                      <p className={`text-2xl font-bold ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}>
                        ₹{filteredGoingTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl p-5 shadow-lg border ${
                  theme === 'light'
                    ? 'bg-indigo-50 border-indigo-200'
                    : 'bg-slate-800/80 border-indigo-500/30'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      theme === 'light'
                        ? 'bg-indigo-100 border-2 border-indigo-300'
                        : 'bg-indigo-500/20 border-2 border-indigo-500/30'
                    }`}>
                      <IndianRupee className={`w-6 h-6 ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Total Trans
                      </p>
                      <p className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                        {filteredTransactions.length + filteredGoingTransactions.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Combined Lists */}
              <div className="space-y-6">
                {/* Going Transactions */}
                {filteredGoingTransactions.length > 0 && (
                  <div className={`rounded-xl shadow-xl border overflow-hidden ${
                    theme === 'light'
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-800/50 border-slate-700'
                  }`}>
                    <div className={`px-6 py-4 border-b ${
                      theme === 'light'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-red-500/20 border-red-500/30'
                    }`}>
                      <h2 className={`text-lg font-bold flex items-center ${
                        theme === 'light' ? 'text-red-700' : 'text-red-400'
                      }`}>
                        <TrendingUp className="w-5 h-5 mr-2" />
                        Going Transactions
                      </h2>
                    </div>
                    <div className={`divide-y ${theme === 'light' ? 'divide-slate-200' : 'divide-slate-700/50'}`}>
                      {filteredGoingTransactions.map((trans, index) => (
                        <div 
                          key={`all-going-${trans.customerId}-${trans.id}-${index}`}
                          className={`px-4 py-3 transition-colors ${
                            theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-slate-700/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                className="relative group/profile"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const tooltip = e.currentTarget.querySelector('.tooltip-content');
                                  if (tooltip) {
                                    tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                    tooltip.style.top = `${rect.top - 10}px`;
                                  }
                                }}
                              >
                                <div className={`w-9 h-9 rounded-full bg-red-500 flex items-center justify-center font-bold text-white text-xs border ${
                                  theme === 'light' ? 'border-red-400/50' : 'border-red-400/30'
                                }`}>
                                  {trans.customerName ? trans.customerName.substring(0, 2).toUpperCase() : trans.customerId.slice(-2)}
                                </div>
                                
                                {/* Hover Tooltip - Fixed Position */}
                                {trans.customerDetails && (
                                  <div className={`tooltip-content fixed -translate-x-1/2 -translate-y-full w-64 border p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-200 z-[9999] text-xs space-y-1.5 backdrop-blur-xl pointer-events-none ${theme === 'light' ? 'bg-white border-gray-200 text-gray-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}`}>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Name:</strong> {trans.customerDetails.name}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>ID:</strong> {trans.customerDetails.id}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Village:</strong> {trans.customerDetails.village || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Phone:</strong> {trans.customerDetails.phone || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Taken Amount:</strong> ₹{trans.customerDetails.takenAmount || 0}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Interest:</strong> {trans.customerDetails.interest || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>PC:</strong> {trans.customerDetails.pc || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Date:</strong> {trans.customerDetails.date || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Weeks:</strong> {trans.customerDetails.weeks || 'N/A'}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`font-semibold text-sm truncate ${
                                    theme === 'light' ? 'text-slate-800' : 'text-slate-200'
                                  }`}>
                                    {trans.customerName || 'Unknown Customer'}
                                  </p>
                                  {trans.day && (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                      theme === 'light' 
                                        ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    }`}>
                                      {trans.day}
                                    </span>
                                  )}
                                  {trans.isDeleted && (
                                    <span className="text-red-500 text-lg leading-none" title="Customer Deleted">🔴</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {trans.comment && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                      theme === 'light'
                                        ? 'bg-orange-100 border border-orange-300 text-orange-700'
                                        : 'bg-orange-500/20 border border-orange-500/30 text-orange-400'
                                    }`}>
                                      {trans.type === 'renewal' ? 'RENEWAL' : trans.type === 'customer_creation' ? 'NEW' : 'RESTORE'}
                                    </span>
                                  )}
                                  <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    ID: {trans.customerId}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right flex-shrink-0">
                              <p className={`text-lg font-bold ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}>
                                -₹{trans.amount.toFixed(2)}
                              </p>
                              <div className="flex items-center justify-end gap-2">
                                <p className={`text-xs flex items-center ${
                                  theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                                }`}>
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {trans.date}
                                </p>
                                {trans.isEdited && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                    theme === 'light' 
                                      ? 'bg-red-100 text-red-700 border border-red-300' 
                                      : 'bg-red-900/40 text-red-300 border border-red-500/50'
                                  }`}>
                                    Edited
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Incoming Transactions */}
                {filteredTransactions.length > 0 && (
                  <div className={`rounded-xl shadow-xl border overflow-hidden ${
                    theme === 'light'
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-800/50 border-slate-700'
                  }`}>
                    <div className={`px-6 py-4 border-b ${
                      theme === 'light'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-blue-500/20 border-blue-500/30'
                    }`}>
                      <h2 className={`text-lg font-bold flex items-center ${
                        theme === 'light' ? 'text-blue-700' : 'text-blue-400'
                      }`}>
                        <TrendingDown className="w-5 h-5 mr-2" />
                        Incoming Transactions
                      </h2>
                    </div>
                    <div className={`divide-y ${theme === 'light' ? 'divide-slate-200' : 'divide-slate-700/50'}`}>
                      {filteredTransactions.map((trans, index) => (
                        <div 
                          key={`all-incoming-${trans.customerId}-${trans.id}-${index}`}
                          className={`px-4 py-3 transition-colors ${
                            theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-slate-700/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                className="relative group/profile"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const tooltip = e.currentTarget.querySelector('.tooltip-content');
                                  if (tooltip) {
                                    tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                    tooltip.style.top = `${rect.top - 10}px`;
                                  }
                                }}
                              >
                                <div className={`w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white text-xs border ${
                                  theme === 'light' ? 'border-blue-400/50' : 'border-blue-400/30'
                                }`}>
                                  {trans.customerName ? trans.customerName.substring(0, 2).toUpperCase() : trans.customerId.slice(-2)}
                                </div>
                                
                                {/* Hover Tooltip - Fixed Position */}
                                {trans.customerDetails && (
                                  <div className={`tooltip-content fixed -translate-x-1/2 -translate-y-full w-64 border p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-200 z-[9999] text-xs space-y-1.5 backdrop-blur-xl pointer-events-none ${theme === 'light' ? 'bg-white border-gray-200 text-gray-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}`}>
                                    <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Name:</strong> {trans.customerDetails.name}</p>
                                    <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>ID:</strong> {trans.customerDetails.id}</p>
                                    <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Village:</strong> {trans.customerDetails.village || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Phone:</strong> {trans.customerDetails.phone || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Taken Amount:</strong> ₹{trans.customerDetails.takenAmount || 0}</p>
                                    <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Interest:</strong> {trans.customerDetails.interest || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>PC:</strong> {trans.customerDetails.pc || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Date:</strong> {trans.customerDetails.date || 'N/A'}</p>
                                    <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Weeks:</strong> {trans.customerDetails.weeks || 'N/A'}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`font-semibold text-sm truncate ${
                                    theme === 'light' ? 'text-slate-800' : 'text-slate-200'
                                  }`}>
                                    {trans.customerName || 'Unknown Customer'}
                                  </p>
                                  {trans.day && (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                      theme === 'light' 
                                        ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    }`}>
                                      {trans.day}
                                    </span>
                                  )}
                                  {trans.isDeleted && (
                                    <span className="text-red-500 text-lg leading-none" title="Customer Deleted">🔴</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {trans.comment && (
                                    <p className={`text-xs italic truncate ${
                                      theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'
                                    }`}>
                                      {trans.comment}
                                    </p>
                                  )}
                                  <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    ID: {trans.customerId}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right flex-shrink-0">
                              <p className={`text-lg font-bold ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                                +₹{trans.amount || 0}
                              </p>
                              <div className="flex items-center justify-end gap-2">
                                <p className={`text-xs flex items-center ${
                                  theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                                }`}>
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {trans.date}
                                </p>
                                {trans.isEdited && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                    theme === 'light' 
                                      ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                                      : 'bg-blue-900/40 text-blue-300 border border-blue-500/50'
                                  }`}>
                                    Edited
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Transactions */}
                {filteredTransactions.length === 0 && filteredGoingTransactions.length === 0 && (
                  <div className={`rounded-xl shadow-xl border overflow-hidden ${
                    theme === 'light'
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-800/50 border-slate-700'
                  }`}>
                    <div className={`text-center py-12 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>
                      <IndianRupee className="w-16 h-16 mx-auto mb-3 opacity-30" />
                      <p>No transactions on this date</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Print Date Range Modal */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className={`${
          theme === 'light' 
            ? 'bg-white border-gray-200' 
            : 'bg-slate-800 border-slate-700'
        }`}>
          <DialogHeader>
            <DialogTitle className={theme === 'light' ? 'text-slate-900' : 'text-white'}>
              Print Collections Statement
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Date Mode Selection */}
            <div className="space-y-2">
              <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
                Date Selection
              </Label>
              <div className="flex gap-4">
                <label className={`flex items-center gap-2 cursor-pointer ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="printDateMode"
                    value="single"
                    checked={printDateMode === 'single'}
                    onChange={(e) => setPrintDateMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">Single Date</span>
                </label>
                <label className={`flex items-center gap-2 cursor-pointer ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="printDateMode"
                    value="range"
                    checked={printDateMode === 'range'}
                    onChange={(e) => setPrintDateMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">Date Range</span>
                </label>
              </div>
            </div>

            {/* Days Selector */}
            <div className="space-y-2">
              <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
                Select Days
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 hover:bg-gray-50'
                        : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    <ChevronDown className="mr-2 h-4 w-4" />
                    <span className="truncate">
                      {printSelectedDays.length === 0 
                        ? 'Select Days' 
                        : printSelectedDays.length === 1 
                          ? printSelectedDays[0] 
                          : printSelectedDays.length === availableDays.length
                            ? 'All Days'
                            : `${printSelectedDays.length} Days`}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={`w-56 p-2 ${
                  theme === 'light' ? 'bg-white' : 'bg-slate-800'
                }`} align="start">
                  <div className="space-y-1">
                    {/* Select All Option */}
                    {availableDays.length > 0 && (
                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors border-b ${
                          theme === 'light'
                            ? 'hover:bg-amber-50 border-slate-200'
                            : 'hover:bg-slate-700 border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={printSelectedDays.length === availableDays.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPrintSelectedDays(availableDays);
                            } else {
                              setPrintSelectedDays(availableDays.length > 0 ? [availableDays[0]] : []);
                            }
                          }}
                          className="w-4 h-4 rounded border-2 border-amber-500"
                        />
                        <span className={`text-sm font-bold ${
                          theme === 'light' ? 'text-amber-700' : 'text-amber-400'
                        }`}>
                          Select All
                        </span>
                      </label>
                    )}
                    
                    {availableDays.map((availableDay) => (
                      <label
                        key={availableDay}
                        className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                          theme === 'light'
                            ? 'hover:bg-blue-50'
                            : 'hover:bg-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={printSelectedDays.includes(availableDay)}
                          onChange={(e) => {
                            let newSelectedDays;
                            if (e.target.checked) {
                              newSelectedDays = [...printSelectedDays, availableDay];
                            } else {
                              newSelectedDays = printSelectedDays.filter(d => d !== availableDay);
                              if (newSelectedDays.length === 0) {
                                newSelectedDays = [availableDay];
                                return;
                              }
                            }
                            setPrintSelectedDays(newSelectedDays);
                          }}
                          className="w-4 h-4 rounded border-2 border-blue-500"
                        />
                        <span className={`text-sm font-medium ${
                          theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                        }`}>
                          {availableDay}
                        </span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Single Date Selector */}
            {printDateMode === 'single' && (
              <div className="space-y-2">
                <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
                  Select Date
                </Label>
                <Popover open={isSingleDateOpen} onOpenChange={setIsSingleDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${
                        theme === 'light'
                          ? 'bg-white border-gray-300 hover:bg-gray-50'
                          : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(printSingleDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <BasicDatePicker
                      value={printSingleDate}
                      onChange={(date) => {
                        if (date) {
                          setPrintSingleDate(date);
                          setIsSingleDateOpen(false);
                        }
                      }}
                      onOpenChange={setIsSingleDateOpen}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Date Range Selector */}
            {printDateMode === 'range' && (
              <>
            
            <div className="space-y-2">
              <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
                From Date
              </Label>
              <Popover open={isFromDateOpen} onOpenChange={setIsFromDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 hover:bg-gray-50'
                        : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(printFromDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <BasicDatePicker
                    value={printFromDate}
                    onChange={(date) => {
                      if (date) {
                        setPrintFromDate(date);
                        setIsFromDateOpen(false);
                      }
                    }}
                    onOpenChange={setIsFromDateOpen}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
                To Date
              </Label>
              <Popover open={isToDateOpen} onOpenChange={setIsToDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 hover:bg-gray-50'
                        : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(printToDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <BasicDatePicker
                    value={printToDate}
                    onChange={(date) => {
                      if (date) {
                        setPrintToDate(date);
                        setIsToDateOpen(false);
                      }
                    }}
                    onOpenChange={setIsToDateOpen}
                  />
                </PopoverContent>
              </Popover>
            </div>
            </>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsPrintModalOpen(false)}
                className={`flex-1 ${
                  theme === 'light'
                    ? 'border-gray-300 hover:bg-gray-50'
                    : 'border-slate-600 hover:bg-slate-700'
                }`}
              >
                Cancel
              </Button>
              <Button
                onClick={generatePDF}
                className={`flex-1 ${
                  theme === 'light'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                <Printer className="w-4 h-4 mr-2" />
                Generate PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Collections;
