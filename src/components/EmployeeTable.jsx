function EmployeeTable({ employees, isLoading, onEmployeeSelect }) {
  const renderField = (label, value) => (
    <div>
      <p className="text-[11px] uppercase tracking-[0.24em] text-blue-100/60">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-blue-50/82">{value}</p>
    </div>
  )

  const handleEmployeeKeyDown = (event, employeeId) => {
    if (!onEmployeeSelect) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onEmployeeSelect(employeeId)
    }
  }

  return (
    <section className="glass rounded-[28px] p-4 sm:rounded-[30px] sm:p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
            Employee Table
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            All employees
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50/76">
            Every non-admin user from Realtime Database is listed here with
            their employee ID, role, and shift timing.
          </p>
        </div>
        <p className="text-sm text-blue-50/68">
          {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-10 text-center text-sm text-blue-50/76">
          Loading employees...
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-10 text-center text-sm text-blue-50/76">
          No employees found yet. Add the first employee to populate the table.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {employees.map((employee) => (
              <article
                key={employee.id}
                className={`rounded-[24px] border border-white/10 bg-slate-950/18 p-4 transition duration-300 hover:-translate-y-1 hover:bg-white/8 ${
                  onEmployeeSelect ? 'cursor-pointer' : ''
                }`}
                onClick={() => onEmployeeSelect?.(employee.id)}
                onKeyDown={(event) => handleEmployeeKeyDown(event, employee.id)}
                role={onEmployeeSelect ? 'button' : undefined}
                tabIndex={onEmployeeSelect ? 0 : undefined}
              >
                <div className="flex flex-col gap-2">
                  <p className="text-lg font-semibold text-white">
                    {employee.name || 'Unnamed Employee'}
                  </p>
                  <p className="break-all text-sm text-blue-50/60">
                    {employee.email || 'No email stored'}
                  </p>
                </div>

                <div className="mt-5 grid gap-4">
                  {renderField('Employee ID', employee.employeeId || '--')}
                  {renderField('Role', employee.role || 'Employee')}
                  {renderField('Shift', employee.shift || 'Not assigned')}
                  {onEmployeeSelect ? renderField('Details', 'Open attendance view') : null}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/16 md:block">
            <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-blue-50/78">
              <thead>
                <tr className="border-b border-white/10 bg-white/6 text-xs uppercase tracking-[0.28em] text-blue-100/60">
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Employee ID</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Shift</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className={`border-b border-white/6 transition-colors hover:bg-white/6 last:border-b-0 ${
                      onEmployeeSelect ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => onEmployeeSelect?.(employee.id)}
                    onKeyDown={(event) => handleEmployeeKeyDown(event, employee.id)}
                    role={onEmployeeSelect ? 'button' : undefined}
                    tabIndex={onEmployeeSelect ? 0 : undefined}
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">
                        {employee.name || 'Unnamed Employee'}
                      </p>
                      <p className="mt-1 break-all text-xs text-blue-50/58">
                        {employee.email || 'No email stored'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-blue-50/74">
                      {employee.employeeId || '--'}
                    </td>
                    <td className="px-5 py-4 text-blue-50/74">
                      {employee.role || 'Employee'}
                    </td>
                    <td className="px-5 py-4 text-blue-50/74">
                      {employee.shift || 'Not assigned'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default EmployeeTable
