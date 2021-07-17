import React, { Component } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, endOfWeek, getDay, startOfDay, add, sub, isBefore, isAfter } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import ReactSearchBox from "react-search-box";
import { IconContext } from "react-icons";
import { RiDeleteBinLine } from "react-icons/ri";
import "./App.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Button, ButtonGroup, InputGroup, Col, Row, Container } from "react-bootstrap";
import { createEvents } from "ics";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ApplicationInsights } from "@microsoft/applicationinsights-web";
import { ReactPlugin, withAITracking } from "@microsoft/applicationinsights-react-js";
import ClickAwayListener from '@material-ui/core/ClickAwayListener';

let reactPlugin, appInsights;
const hasInsights = process.env.NODE_ENV !== 'development';
if (hasInsights) {
  reactPlugin = new ReactPlugin();
  appInsights = new ApplicationInsights({
    config: {
      connectionString: process.env.REACT_APP_INSIGHTS_STRING,
      disableFetchTracking: false,
      enableCorsCorrelation: true,
      enableRequestHeaderTracking: true,
      enableResponseHeaderTracking: true,
      extensions: [reactPlugin]
    }
  });
}

const locales = {
  'en-US': require('date-fns/locale/en-US'),
}
const localizer = dateFnsLocalizer({
  format, parse, startOfWeek, getDay, locales
});

const anuTimeZone = "Australia/Canberra";
const anuInitialTime = utcToZonedTime(new Date(), anuTimeZone);

class App extends Component {
  state = {
    dayStart: add(startOfDay(anuInitialTime), {hours: 9}),
    dayEnd: add(startOfDay(anuInitialTime), {hours: 17, minutes: 30}),
    cacheStart: sub(startOfWeek(anuInitialTime), {weeks: 1}),
    cacheEnd: add(endOfWeek(anuInitialTime), {weeks: 1}),
    modules: [],
    enrolled: JSON.parse(localStorage.getItem('enrolled')) || [],
    events: [{
      title: "MEDI8020A_S1 Workshop",
      description: "Medicine 2",
      start: zonedTimeToUtc("2021-04-20 09:00:00", anuTimeZone),
      end: zonedTimeToUtc("2021-04-20 10:00:00", anuTimeZone)
    }, {
      title: "MEDI8020A_S1 Workshop",
      description: "Medicine 2",
      start: zonedTimeToUtc("2021-04-21 09:00:00", anuTimeZone),
      end: zonedTimeToUtc("2021-04-21 10:00:00", anuTimeZone)
    }, {
      title: "MEDI8020A_S1 Lecture",
      description: "Medicine 2",
      start: zonedTimeToUtc("2021-04-22 09:00:00", anuTimeZone),
      end: zonedTimeToUtc("2021-04-22 10:00:00", anuTimeZone)
    }],
    icalEndDate: add(endOfWeek(anuInitialTime), {weeks: 1})
  };

  addEvent(start, end, event) {
    fetch(`/api/ClassSchedules?name=${event
        }&start=${format(start, "yyyy-MM-dd")
        }&end=${format(end, "yyyy-MM-dd")}`
    ).then(res => {
        if (!res.ok)
          throw new Error('Timetable API request failed')
        return res.json();
      })
      .then(
        res => {
          console.log(res)
          let events = [...this.state.events];
          for (let session of res.TeachingSessions) {
            // TODO add faculty or randomised (hash) colours
            events.push({
              title: `${session.modulename} ${session.activitytype}`,
              description: session.moduledescription,
              start: utcToZonedTime(new Date(session.teachingsessionstartdatetime), anuTimeZone),
              end: utcToZonedTime(new Date(session.teachingsessionenddatetime), anuTimeZone)
            })
          }
          this.setState({ events });
        },
        err => console.error(err)
      )
  }

  addEvents(start, end) {
    for (let module of this.state.enrolled) {
      this.addEvent(start, end, module);
    }
  }

  downloadEvents() {
    if (this.state.icalEndDate) {
      this.addEvents(this.state.cacheEnd, this.state.icalEndDate)
    }

    const element = document.createElement("a");
    const { value } = createEvents(this.state.events.map(event => ({
        ...event,
        start: format(event.start, 'y,M,d,H,m,s').split(','),
        end: format(event.end, 'y,M,d,H,m,s').split(',')
    })))
    const file = new Blob([value], {type: 'text/calendar'});
    element.href = URL.createObjectURL(file);
    const d = new Date();
    element.download = `ANU Timetable ${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}.ics`;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }

  eventColor(event) {
    // TODO prettier faculty-based colours (_drama_)? Also hash could cause black on black and other problems
    return "#" + this.intToRGB(this.hashCode(event.title));
  }
  // https://stackoverflow.com/a/3426956/
  hashCode(str) { // java String#hashCode
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
       hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }
  intToRGB(i){
      var c = (i & 0x00FFFFFF)
          .toString(16)
          .toUpperCase();

      return "00000".substring(0, 6 - c.length) + c;
  }

  componentDidMount(){
    if (hasInsights) {
      appInsights.loadAppInsights();
      appInsights.trackPageView();
    }

    // Generated from master branch with \( "[^\\]+)\\u00a0 '{"key":$1","value":$1 - ' and find/replace
    // TODO use scheduled function to pull all courses and update json if necessary
    fetch('./courses.json')
      .then(res => {
        if (!res.ok)
          throw new Error(`Couldn't load courses from JSON cache`)
        return res.json();
      })
      .then(res => this.setState({
        modules: res.courses
      }))
    this.addEvents(this.state.cacheStart, this.state.cacheEnd);
  }

  deleteModule(module) {
    // Remove a course and all associated events/classes
    let events = [...this.state.events];

    // Get index of first event for this module
    let firstIndex = events.length;
    for (let i = 0; i < events.length; i++) {
      if (events[i].title.startsWith(module)) {
        firstIndex = i;
        break;
      }
    }

    // Delete all events for this module/course
    for (let lastIndex = firstIndex + 1; lastIndex <= events.length; lastIndex++) {
      if (lastIndex === events.length || !events[lastIndex].title.startsWith(module)) {
        events.splice(firstIndex, lastIndex - firstIndex);
        this.setState({ events });
        break;
      }
    }

    // Delete this course from the course list
    let index = this.state.enrolled.indexOf(module);
    if (index !== -1) {
      let enrolled = [...this.state.enrolled];
      enrolled.splice(index, 1);
      this.setState({ enrolled });
    }

    this.updateLocalStorage();
  }

  addModule(module) {
    // Add a course
    let enrolled = [...this.state.enrolled];
    enrolled.push(module);
    this.setState({ enrolled });
    this.updateLocalStorage();
    this.addEvent(this.state.cacheStart, this.state.cacheEnd, module);
  }

  updateLocalStorage() {
    localStorage.setItem('enrolled', JSON.stringify(this.state.enrolled));
    // TODO: do we want to cache events as well?
  }

  rangeChanged(range) {
    // Calendar view date bounds changed, update cache
    const newEnd = add(range[range.length - 1], { weeks: 1 });

    if (isAfter(newEnd, this.state.cacheEnd)) {
      this.addEvents(this.state.cacheEnd, newEnd);
      this.setState({
        cacheEnd: newEnd
      });
    } else {
      const newStart = sub(range[0], { weeks: 1 });

      if (isBefore(newStart, this.state.cacheStart)) {
        this.addEvents(newStart, this.state.cacheStart);
        this.setState({
          cacheStart: newStart
        });
      }
    }
  }

  chooseEvent(event) {
    // Choose a time slot for a class
    // This filters out all other interchangeable events
    let events = this.state.events.filter(target => target.title !== event.title);
    events.push(event);
    this.setState({ events });
  }

  deleteEvent(event) {
    // Unselect a time slot for a class
    let index = this.state.events.indexOf(event.event);
    if (index !== -1) {
      this.state.events.splice(index, 1)
    }
  }

  render() {
    const hasCourses = this.state.enrolled.length !== 0;
    const showICS = hasCourses && this.state.events.length > 0;
    return (
      <div className="App">
        <Container fluid>
          <Row><Col><h1>Unofficial ANU Timetable</h1></Col></Row>

          {/* Current course list */}
          <Row>
            <Col md='auto'><i>Courses chosen: {hasCourses ? '' : 'None.'}</i></Col>
            <IconContext.Provider value={{ color: "red", size: "1.5em" }}>
              {this.state.enrolled.map(module =>
                <Col md='auto' key={module}>
                  <i>{module}</i>
                  <RiDeleteBinLine onClick={() => this.deleteModule(module)}/>
                </Col>
              )}
            </IconContext.Provider>
          </Row>

          <Row><InputGroup>
            {/* Course search */}
            <Col xs md="8" lg="7" xl="5" className={'search-container ' + (!this.state.searchFocused ? 'empty' : '')}>
              <ClickAwayListener onClickAway={() => this.setState({ searchFocused: false })}>
                <ReactSearchBox
                  autoFocus
                  placeholder="Enter a course code here (for example LAWS1201)"
                  data={this.state.modules}
                  value={this.state.searchVal}
                  onSelect={record => {
                    this.addModule(record.key);
                  }}
                  onFocus={() => this.setState({ searchFocused: true })}
                />
              </ClickAwayListener>
            </Col>

            {/* Calendar export */}
            <Col>
              <ButtonGroup>
                <DatePicker selected={this.state.icalEndDate}
                  onChange={icalEndDate => this.setState({ icalEndDate })}
                  className={'date-picker ' + (!showICS ? 'full' : '')} />
                {showICS && (
                <Button onClick={() => {this.downloadEvents()}}
                  className='ics-export'>
                  Export .ics
                </Button>
                )}
              </ButtonGroup>
            </Col>
          </InputGroup></Row>

          {/* Calendar view */}
          <Row><Col><Calendar popup
            localizer={localizer}
            events={this.state.events}
            style={{ height: "85vh" }}
            defaultView='work_week' views={['work_week']}
            min={this.state.dayStart} max={this.state.dayEnd}
            formats={{
              dayFormat: (date, culture) => localizer.format(date, 'EEEE', culture),
              eventTimeRangeFormat: () => ""
            }}
            // Display descriptive name as tooltip
            tooltipAccessor={event => event.description}

            // Delete on double click
            // onDoubleClickEvent={event => this.deleteEvent(event)}

            // Get events in new unloaded range - assumes pagination in only one direction
            onRangeChange={this.rangeChanged.bind(this)}

            components={{
              event: event => <div>
                {event.title}<br></br><br></br><ButtonGroup>
                  {!event.title.endsWith('Lecture') ? <Button size="sm" onClick={() => this.chooseEvent(event)}>Choose</Button> : ''}
                  <Button size="sm" variant="danger" onClick={() => this.deleteEvent(event)}>Delete</Button>
                </ButtonGroup>
              </div>
            }}

            eventPropGetter={event => ({
              style: {
                backgroundColor: this.eventColor(event),
                border: '1px solid black'
              }
            })}
          /></Col></Row>

          {/* Footer */}
          <Row><Col><footer style={{textAlign: "center"}}>
            Made with <span role="img" aria-label="love">💖</span>
            by <a href="https://github.com/pl4nty">Tom Plant</a>, report issues&nbsp;
            <a href="https://github.com/pl4nty/anutimetable/issues">here</a>
          </footer></Col></Row>
        </Container>
      </div>
    );
  }
}

export default hasInsights ? withAITracking(reactPlugin, App) : App;
