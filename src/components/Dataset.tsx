import { useState } from 'react';
import { Database, Search } from 'lucide-react';
import type { GoldenDatasetItem } from '../types.ts';

interface DatasetProps {
  goldenDataset: GoldenDatasetItem[];
}

export default function Dataset({ goldenDataset }: DatasetProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredDataset = goldenDataset.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.expected_answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="glass-panel panel-padded">
      <div className="flex-row justify-between flex-wrap gap-lg" style={{ marginBottom: '1.5rem' }}>
        <h3 className="panel-title" style={{ marginBottom: 0 }}>
          <Database size={18} />
          Golden Evaluation Benchmark Dataset
        </h3>
        <div className="flex-row gap-md">
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search benchmark..."
              aria-label="Search benchmark dataset"
              className="form-input search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            style={{ width: '180px', height: '36px' }}
            aria-label="Filter dataset by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Domains</option>
            <option value="Customer Support">Customer Support</option>
            <option value="Technical & Coding">Technical & Coding</option>
            <option value="Financial & Data Extraction">Finance & Data</option>
            <option value="Legal & Document Analysis">Legal & Contract</option>
          </select>
        </div>
      </div>

      <div className="dataset-table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th style={{ width: '150px' }}>Category</th>
              <th>Test Question / Query</th>
              <th>Expected Ground Truth</th>
              <th>Reference Document Context</th>
            </tr>
          </thead>
          <tbody>
            {filteredDataset.map((item) => (
              <tr key={item.id}>
                <td className="text-mono text-bold">{item.id}</td>
                <td><span className="tag-pill">{item.category}</span></td>
                <td style={{ fontSize: '0.85rem', fontWeight: 550 }}>{item.question}</td>
                <td className="text-sm text-muted">{item.expected_answer}</td>
                <td className="text-md truncate-ellipsis" style={{ color: 'var(--color-text-muted)' }}>
                  {item.reference_context}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
