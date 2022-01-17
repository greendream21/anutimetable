import { forwardRef } from 'react'

import { InputGroup, Dropdown, DropdownButton } from 'react-bootstrap'
import { Token, Typeahead } from 'react-bootstrap-typeahead'
import TimezoneSelect from 'react-timezone-select'

import Export from './Export'

export default forwardRef(({ API, state: {
  timeZone, year, session, sessions, timetableData, modules, selectedModules, darkMode,
  setTimeZone, setYear, setSession, setSessions, setTimetableData, setModules, setSelectedModules,
} }, calendar) => {
  const selectYear = e => {
    if (e === year) return
    setSelectedModules([])
    setYear(e)
    // Assume ascending session order
    setSession(sessions[e]?.[sessions[e].length-1] || '')
  }
  const selectSession = e => {
    if (e === session) return
    setSelectedModules([])
    setSession(e)
  }

  return <>
  <InputGroup className="mb-2">
    <DropdownButton
      as={InputGroup.Prepend}
      variant="outline-primary"
      title={year}
    >
      {/* reverse() - years (numerical keys) are in ascending order per ES2015 spec */}
      {Object.keys(sessions).reverse().map(e => <Dropdown.Item key={e} onClick={() => selectYear(e)}>{e}</Dropdown.Item>)}
    </DropdownButton>

    <DropdownButton
      as={InputGroup.Prepend}
      variant="outline-primary"
      title={session}
    >
      {sessions[year]?.map(e => <Dropdown.Item key={e} onClick={() => selectSession(e)}>{e}</Dropdown.Item>)}
    </DropdownButton>

    <Typeahead
      id="course-search-box"

      clearButton
      emptyLabel="No matching courses found"
      isLoading={Object.keys(modules).length === 0}
      multiple
      highlightOnlyResult
      labelKey='title'
      placeholder="Enter a course code here (for example LAWS1201)"
      // Overwrite bad id property (eg LAWS1201_S1 -> LAWS1201)
      options={Object.entries(modules).map(([id, val]) => ({...val, id}))}
      onChange={setSelectedModules}
      selected={selectedModules}
      // modified from default: https://github.com/ericgio/react-bootstrap-typeahead/blob/8dcac67b57e9ee121f5a44f30c59346a32b66d48/src/components/Typeahead.tsx#L143-L156
      renderToken={(option, props, idx) => <Token
        disabled={props.disabled}
        key={idx}
        onRemove={props.onRemove}
        option={option}
        tabIndex={props.tabIndex}
        href={`http://programsandcourses.anu.edu.au/${year}/course/${option.id}`}
      >
        <a
          href={`http://programsandcourses.anu.edu.au/${year}/course/${option.id}`}
          target={"_blank"}
          rel={"noreferrer"}
        >{option.id}</a> {/** use id (eg COMP1130) instead of label to save space */}
      </Token>}
    />

    {/* somehow there's no NPM module for this. maybe I should write one? */}
    {selectedModules.length !== 0 && <Export API={API} year={year} session={session} />}
  </InputGroup>
  <TimezoneSelect
    theme={(theme)=>({
      ...theme,
      colors: {
        ...theme.colors,
        neutral0: darkMode ? '#101214' : '#fff',
        neutral80: darkMode ? '#fff' : '#000',
        primary25: darkMode ? '#343A40' : '#deebff',
        primary: darkMode ? '#42A5FF' : '#1854A2',
      }
    })}
    className='timezone-select mb-2'
    value={timeZone}
    onChange={tz => setTimeZone(tz.value)}
  />
  </>
})
