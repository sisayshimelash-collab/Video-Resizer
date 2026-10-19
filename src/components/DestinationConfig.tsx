import React, { useState } from 'react';
import { Folder, FolderOpen, AlertCircle, FileCheck } from 'lucide-react';
import { openFolderPicker } from '../api';

interface DestinationConfigProps {
  sourcePath: string;
  outputPath: string;
  onChangeOutputPath: (path: string) => void;
  allowOverwrite: boolean;
  onToggleAllowOverwrite: (allow: boolean) => void;
  isConflict: boolean;
}

export const DestinationConfig: React.FC<DestinationConfigProps> = ({
  sourcePath,
  outputPath,
  onChangeOutputPath,
  allowOverwrite,
  onToggleAllowOverwrite,
  isConflict,
}) => {
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);

  // Parse path components for user-friendly editing
  const lastSlash = Math.max(outputPath.lastIndexOf('\\'), outputPath.lastIndexOf('/'));
  const folderPart = lastSlash !== -1 ? outputPath.slice(0, lastSlash) : '';
  const filePart = lastSlash !== -1 ? outputPath.slice(lastSlash + 1) : outputPath;

  const handleChooseFolder = async () => {
    try {
      setIsOpeningFolder(true);
      const res = await openFolderPicker(folderPart);
      if (!res.canceled && res.path) {
        const newPath = `${res.path}\\${filePart}`;
        onChangeOutputPath(newPath);
      }
    } catch (err) {
      console.error('Folder picker error:', err);
    } finally {
      setIsOpeningFolder(false);
    }
  };

  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const newPath = folderPart ? `${folderPart}\\${newName}` : newName;
    onChangeOutputPath(newPath);
  };

  const isSameAsSource =
    sourcePath.trim().toLowerCase() === outputPath.trim().toLowerCase();

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
          Destination & Output File
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '2px' }}>
          Choose where the compressed video will be saved on your PC.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Output Folder Selector */}
        <div>
          <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
            Output Directory
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div
              className="font-mono"
              style={{
                flex: 1,
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '0.85rem',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={folderPart}
            >
              <Folder size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {folderPart || 'Same as source directory'}
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleChooseFolder}
              disabled={isOpeningFolder}
              style={{ padding: '10px 16px', fontSize: '0.85rem' }}
            >
              <FolderOpen size={16} />
              <span>Change Folder...</span>
            </button>
          </div>
        </div>

        {/* Output File Name */}
        <div>
          <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
            Output Filename
          </label>
          <input
            type="text"
            value={filePart}
            onChange={handleFileNameChange}
            className="font-mono"
            style={{
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: isConflict || isSameAsSource ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: '0.88rem',
              color: '#fff',
              outline: 'none',
            }}
          />
        </div>

        {/* Safety & Conflict Alerts */}
        {isSameAsSource && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fda4af',
              fontSize: '0.84rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Safety Guard:</strong> Destination cannot be the same as the source file. The original is protected and will never be overwritten.
            </span>
          </div>
        )}

        {isConflict && !isSameAsSource && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.84rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>A file with this name already exists in the destination folder.</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={allowOverwrite}
                onChange={(e) => onToggleAllowOverwrite(e.target.checked)}
              />
              <span>Allow overwrite existing output</span>
            </label>
          </div>
        )}

        {/* Full Destination Path Preview */}
        {!isSameAsSource && !isConflict && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: 'var(--text-dim)',
            }}
          >
            <FileCheck size={14} color="#34d399" />
            <span>Output will be saved as:</span>
            <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
              {outputPath}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
