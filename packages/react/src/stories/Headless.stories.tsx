import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ZipIt } from '../components';

const meta: Meta<typeof ZipIt.Provider> = {
  title: 'Headless/ZipIt',
  component: ZipIt.Provider,
};

export default meta;

export const HeadlessExample: StoryObj = {
  render: () => (
    <ZipIt.Provider config={{ concurrency: 2 }}>
      <ZipIt.StartButton>
        {({ onClick, disabled, status }) => (
          <button onClick={onClick} disabled={disabled}>
            Status: {status}
          </button>
        )}
      </ZipIt.StartButton>

      <ZipIt.GlobalProgress>
        {({ percent }) => (
          <div style={{ width: '100%', background: '#eee', height: '10px', marginTop: '10px' }}>
            <div style={{ width: `${percent}%`, background: 'blue', height: '100%' }} />
          </div>
        )}
      </ZipIt.GlobalProgress>

      <ZipIt.FileList>
        {(files) => (
          <ul>
            {files.map(f => (
              <li key={f.fileId}>{f.fileId}: {f.phase}</li>
            ))}
          </ul>
        )}
      </ZipIt.FileList>
    </ZipIt.Provider>
  ),
};
